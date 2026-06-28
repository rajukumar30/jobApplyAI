const path = require('path');
const fs = require('fs');
const geminiService = require('../services/gemini/geminiService');
const linkedinService = require('../services/linkedin/linkedinService');
const applicationStore = require('../services/applicationStore');
const resumeController = require('./resumeController');
const { generateTailoredResumePdf } = require('../services/pdf/latexService');
const { listResumeFormats } = require('../services/pdf/formatRegistry');
const { collectJdKeywords } = require('../services/pdf/keywordHighlighter');
const { evaluateCollegeTier } = require('../services/pdf/collegeTierService');
const { getPrimaryCollege } = require('../services/pdf/educationUtils');
const { supabase } = require('../services/supabase/supabaseService');
const fakeJobDetectionService = require('../services/fakeJobDetectionService');
const { extractJdText } = require('../services/jd/jdParserService');

// ── Cancellation ─────────────────────────────────────────────────────────────
// Returns an AbortSignal that fires when the client disconnects before the
// response is finished (e.g. the user clicks "Cancel" in the UI, which aborts
// the in-flight request). This lets us stop the Gemini pipeline server-side.
function abortSignalForRequest(req, res) {
  const controller = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

function isCancelled(signal, err) {
  return (signal && signal.aborted) || geminiService.isCancel(err);
}

// ── Parse JD from uploaded file (PDF, DOC, image, TXT, etc.) ───────────────
async function parseJd(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No job description file uploaded.' });
  }

  try {
    console.log(`📎 Parsing JD file: ${req.file.originalname} (${req.file.mimetype})`);
    const text = await extractJdText(req.file);

    if (!text || text.trim().length < 50) {
      return res.status(400).json({
        error: 'Could not extract enough text from the file. Try a clearer file or paste the description manually.',
      });
    }

    return res.json({
      success: true,
      text: text.trim(),
      filename: req.file.originalname,
      charCount: text.trim().length,
    });
  } catch (err) {
    console.error('❌ JD file parse error:', err.message);
    return res.status(422).json({ error: err.message || 'Failed to parse job description file.' });
  }
}

// ── Analyze Job ──────────────────────────────────────────────────────────────
async function analyzeJob(req, res) {
  const { text, url, detectFakeJob } = req.body;

  if (!text && !url) {
    return res.status(400).json({ error: 'Provide either job description text or a LinkedIn URL.' });
  }

  let description = text;
  let source = 'text';

  // If URL provided, try to fetch the job page
  if (url && !text) {
    console.log(`🔗 Fetching LinkedIn job page: ${url}`);
    const fetchResult = await linkedinService.fetchJobPageUnauthenticated(url);

    if (fetchResult.requiresLogin) {
      return res.status(422).json({
        error: 'LinkedIn blocks automated access to this post. Paste the job description text instead.',
        requiresLinkedInLogin: false,
      });
    } else if (fetchResult.success) {
      description = fetchResult.description;
      source = 'linkedin_scraped';
    } else {
      return res.status(422).json({
        error: 'Could not extract job description from the URL. Please paste the description manually.',
      });
    }
  }

  if (!description || description.trim().length < 50) {
    return res.status(400).json({ error: 'Job description is too short or empty.' });
  }

  const signal = abortSignalForRequest(req, res);

  try {
    console.log(`🤖 Analyzing job with Gemini (source: ${source})...`);
    
    // Concurrently run regular analysis and fake job detection (if requested)
    const analysisPromise = geminiService.analyzeJob(description, { signal });
    
    let fakeJobPromise = Promise.resolve(null);
    if (detectFakeJob) {
      console.log(`🛡️ Fake job detection requested. Extracting data...`);
      fakeJobPromise = geminiService.extractLinkedInPostData(description, { signal })
        .then(extractedData => fakeJobDetectionService.scoreFakeJob(extractedData))
        .catch(err => {
          console.warn(`⚠️ Fake job detection failed, proceeding without it: ${err.message}`);
          return null;
        });
    }

    const [jobData, fakeJobAnalysis] = await Promise.all([analysisPromise, fakeJobPromise]);

    // Fallback regex to find email if AI misses it
    if (!jobData.recruiterEmail && !jobData.applicationEmail) {
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
      const foundEmails = description.match(emailRegex);
      if (foundEmails && foundEmails.length > 0) {
        jobData.recruiterEmail = foundEmails[0];
      }
    }
    // If only applicationEmail found, copy to recruiterEmail for UI compatibility
    if (!jobData.recruiterEmail && jobData.applicationEmail) {
      jobData.recruiterEmail = jobData.applicationEmail;
    }

    // ── Duplicate application check ──────────────────────────────────────
    let duplicateWarning = null;
    if (jobData.company) {
      const previousApplications = await applicationStore.checkDuplicate(req.user.uid, jobData.company);
      if (previousApplications.length > 0) {
        duplicateWarning = {
          isDuplicate: true,
          count: previousApplications.length,
          previousApplications,
          message: `You have already applied to ${jobData.company} before.`,
        };
        console.log(`⚠️  Duplicate detected: ${previousApplications.length} previous application(s) to ${jobData.company}`);
      }
    }

    return res.json({
      success: true,
      source,
      jobData,
      duplicateWarning,
      fakeJobAnalysis,
    });
  } catch (err) {
    if (isCancelled(signal, err)) {
      console.log('🚫 Job analysis cancelled by user.');
      return;
    }
    console.error('❌ Job analysis error:', err.message);
    if (!res.writableEnded) return res.status(500).json({ error: `Failed to analyze job: ${err.message}` });
  }
}

// ── Session-only tailored PDF metadata (file already in generated-resumes/) ───
function saveTailoredResumeForSession(userId, pdfBuffer, filenameBase, jobData, tailoredData) {
  const filename = `${filenameBase}.pdf`;

  emitProgress(userId, 'upload', 'done', 'PDF ready for email (session only, not saved to library).');

  const tailoredResume = {
    userId,
    id: `session_${Date.now()}`,
    filename,
    originalName: `Tailored Resume for ${jobData?.jobTitle || 'Role'}.pdf`,
    fileSize: pdfBuffer.length,
    uploadedAt: new Date().toISOString(),
    parsedData: tailoredData,
    firebaseStoragePath: null,
    isTailored: true,
    sessionOnly: true,
  };

  return { tailoredResume, supabasePublicUrl: null };
}

// ── Legacy: upload tailored PDF to Supabase + library (unused by apply/tailor flows)
async function saveTailoredResumeRecord(userId, pdfBuffer, filenameBase, jobData, tailoredData) {
  let firebaseStoragePath = null;
  let supabasePublicUrl = null;

  if (supabase) {
    emitProgress(userId, 'upload', 'running', 'Uploading tailored PDF to cloud storage...');
    const destFileName = `${userId}/${filenameBase}.pdf`;
    console.log(`☁️ Uploading tailored resume to Supabase Storage: tailored-resumes/${destFileName}...`);

    const { error: bucketError } = await supabase.storage.createBucket('tailored-resumes', {
      public: false,
      fileSizeLimit: 10485760,
    });
    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('❌ Failed to create tailored-resumes bucket:', bucketError.message);
    }

    const { data, error } = await supabase.storage
      .from('tailored-resumes')
      .upload(destFileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('❌ Failed to upload tailored resume to Supabase:', error.message);
      emitProgress(userId, 'upload', 'warn', 'Cloud upload failed - using local fallback.');
    } else {
      firebaseStoragePath = data.path;
      console.log('✅ Tailored resume uploaded successfully.');
      emitProgress(userId, 'upload', 'done', 'Tailored resume uploaded to cloud.');

      const { data: signedData, error: signedError } = await supabase.storage
        .from('tailored-resumes')
        .createSignedUrl(destFileName, 3600);

      if (signedError) {
        console.warn('⚠️ Could not generate signed URL:', signedError.message);
      } else {
        supabasePublicUrl = signedData.signedUrl;
      }
    }
  }

  const tailoredResume = {
    userId,
    id: `tailored_${Date.now()}`,
    filename: `${filenameBase}.pdf`,
    originalName: `Tailored Resume for ${jobData?.jobTitle || 'Role'}.pdf`,
    fileSize: pdfBuffer.length,
    uploadedAt: new Date().toISOString(),
    parsedData: tailoredData,
    firebaseStoragePath,
    isTailored: true,
  };

  let dbSaved = false;
  if (supabase) {
    const { id: _localId, ...insertPayload } = tailoredResume;
    const { data, error } = await supabase.from('resumes').insert([insertPayload]).select();

    if (error) {
      console.error('❌ Failed to save tailored resume metadata to Supabase DB:', error.message);
    } else if (data && data.length > 0) {
      tailoredResume.id = data[0].id;
      console.log('✅ Tailored resume metadata saved to Supabase DB.');
      dbSaved = true;
    }
  }

  if (!dbSaved) {
    console.log('⚠️ Saving tailored resume locally as fallback.');
    try {
      const localStore = await resumeController.readStore(userId);
      localStore.push(tailoredResume);
      const { writeUserJson } = require('../services/userStorage');
      writeUserJson(userId, 'resumeStore.json', localStore);
    } catch (localErr) {
      console.error('❌ Failed to save to local store:', localErr.message);
    }
  }

  return { tailoredResume, supabasePublicUrl };
}

// ── Match Resumes ────────────────────────────────────────────────────────────
async function matchResumes(req, res) {
  const { jobData, forceTailor, deferPdfGeneration } = req.body;

  if (!jobData) {
    return res.status(400).json({ error: 'Job data is required for resume matching.' });
  }

  const resumes = await resumeController.readStore(req.user.uid);
  // Filter out already tailored resumes so we don't match against them
  const originalResumes = resumes.filter(r => !r.isTailored);

  if (originalResumes.length === 0) {
    return res.status(404).json({ error: 'No original resumes found. Please upload at least one resume.' });
  }

  const signal = abortSignalForRequest(req, res);

  try {
    console.log(`🤖 Matching ${originalResumes.length} original resume(s) with Gemini...`);
    const matchResult = await geminiService.matchResumes(jobData, originalResumes, { signal });

    // Use the AI's intelligent score directly
    matchResult.rankings.sort((a, b) => b.score - a.score);
    matchResult.bestMatchIndex = matchResult.rankings[0].index;
    const bestScore = matchResult.rankings[0].score;

    const enrichedRankings = matchResult.rankings.map(ranking => ({
      ...ranking,
      resume: (() => {
        const r = originalResumes[ranking.index];
        if (!r) return null;
        const { rawText, ...safe } = r;
        return safe;
      })(),
    }));

    const bestResume = (() => {
      const r = originalResumes[matchResult.bestMatchIndex];
      if (!r) return null;
      const { rawText, ...safe } = r;
      return safe;
    })();

    emitProgress(req.user.uid, 'match_resume', 'done', `Matched ${originalResumes.length} resume(s). Best score: ${matchResult.rankings[0]?.score ?? '?'}%`);

    let tailoringPerformed = false;
    let tailoredResume = null;
    let tailoredMatchPercentage = null;
    let latexCode = null;
    let supabasePublicUrl = null;  // signed URL for the tailored PDF (set when Supabase upload succeeds)
    let tailoringResult = null;    // full result including atsReport
    let rewrittenContent = null;
    let originalDataSnapshot = null;
    let tailoredDataSnapshot = null;
    let collegeTierInfo = null;

    // ── AI Resume Tailoring (if score < 80, or forceTailor for dedicated tailor flow) ──
    emitProgress(req.user.uid, 'score', 'running', 'Evaluating resume match quality...');
    const shouldTailor = !!forceTailor || bestScore < 80;
    if (shouldTailor && bestResume) {
      if (forceTailor) {
        console.log(`✨ Force-tailor requested. Tailoring best resume (score ${bestScore}%)...`);
      } else {
        console.log(`⚠️ Best match score is ${bestScore}%. Initiating AI Resume Tailoring...`);
      }
      try {
        tailoringPerformed = true;
        emitProgress(req.user.uid, 'score', 'done', `Best match: ${bestScore}% - tailoring resume for better fit...`);

        // 1. ATS keyword gap analysis + tailoring (2-stage pipeline inside geminiService)
        emitProgress(req.user.uid, 'tailor', 'running', 'Stage 1: Extracting ATS keywords and running gap analysis...');
        tailoringResult = await geminiService.tailorResume(jobData, bestResume, { signal });
        let tailoredData = tailoringResult.tailoredData;
        const rewrittenSections = tailoringResult.rewrittenContent;
        const atsReport = tailoringResult.atsReport || {};

        if (!tailoredData || !rewrittenSections) {
          throw new Error('AI returned an invalid response missing tailored data.');
        }

        // 2. Build PDF using the fixed LaTeX template (falls back to pdfmake if pdflatex unavailable)
        // IMPORTANT: Pass originalData + rewrittenSections separately so the template
        // uses original data for locked fields and AI content only for the 4 editable placeholders.
        if (signal.aborted) throw new geminiService.CancelledError();

        const injected = (atsReport.missingKeywordsInjected || []).length;
        emitProgress(req.user.uid, 'tailor', 'done', `Stage 2: ATS optimization complete - ${injected} missing keywords injected.`);

        const originalData = bestResume.parsedData || {};
        if (bestResume.rawText) resumeController.backfillEducationYears(originalData, bestResume.rawText);
        rewrittenContent = rewrittenSections;
        originalDataSnapshot = originalData;
        tailoredDataSnapshot = tailoredData;

        const primaryCollege = getPrimaryCollege(originalData.education);
        if (primaryCollege) {
          emitProgress(req.user.uid, 'tailor', 'running', 'Evaluating college tier for education placement...');
          collegeTierInfo = await evaluateCollegeTier(
            primaryCollege.institution,
            primaryCollege.degree,
            jobData,
            { signal }
          );
          console.log(`🎓 College tier: ${collegeTierInfo.tierLabel} — education ${collegeTierInfo.placeEducationAtTop ? 'top' : 'bottom'}`);
        }

        if (deferPdfGeneration) {
          emitProgress(req.user.uid, 'compile_pdf', 'done', 'Content ready — choose a format on the results page.');
          emitProgress(req.user.uid, 'upload', 'done', 'PDF generation deferred until you pick a format.');
          if (!signal.aborted) {
            console.log('🤖 Scoring tailored resume (format selection)...');
            tailoredMatchPercentage = await geminiService.scoreTailoredResume(jobData, tailoredData, {
              signal,
              baselineScore: bestScore,
              atsReport: tailoringResult?.atsReport,
            });
            console.log(`📈 Tailored ATS match: ${tailoredMatchPercentage}%`);
          }
        } else {
          emitProgress(req.user.uid, 'compile_pdf', 'running', 'Compiling ATS-optimized resume to PDF...');
          const safeJobTitle = (jobData.jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g, '_');
          const filenameBase = `tailored_resume_${safeJobTitle}_${Date.now()}`;
          const highlightKeywords = collectJdKeywords(jobData);
          const pdfBuffer = await generateTailoredResumePdf(
            req.user.uid,
            originalData,
            rewrittenSections,
            filenameBase,
            { formatId: 'ats-classic', highlightKeywords, collegeTierInfo }
          );
          emitProgress(req.user.uid, 'compile_pdf', 'done', 'PDF compiled successfully.');

          const saved = saveTailoredResumeForSession(
            req.user.uid,
            pdfBuffer,
            filenameBase,
            jobData,
            tailoredData
          );
          tailoredResume = saved.tailoredResume;
          supabasePublicUrl = saved.supabasePublicUrl;

          console.log('🤖 Re-evaluating tailored resume score...');
          tailoredMatchPercentage = await geminiService.scoreTailoredResume(jobData, tailoredData, {
            signal,
            baselineScore: bestScore,
            atsReport: tailoringResult?.atsReport,
          });
          console.log(`📈 New score after tailoring: ${tailoredMatchPercentage}%`);
          emitProgress(req.user.uid, 'email', 'done', `Ready. New match score: ${tailoredMatchPercentage}%`);
        }

      } catch (err) {
        // Propagate user cancellation so the outer handler can stop cleanly
        // instead of silently falling back to the original resume.
        if (isCancelled(signal, err)) throw err;
        console.error('❌ Tailoring pipeline failed:', err.message);
        // Fallback to original resume if tailoring fails
        tailoringPerformed = false;
        tailoredResume = null;
      }
    }

    if (signal.aborted) {
      console.log('🚫 Resume matching cancelled by user.');
      return;
    }

    return res.json({
      success: true,
      totalResumes: resumes.length,
      rankings: enrichedRankings,
      bestMatchIndex: matchResult.bestMatchIndex,
      bestMatchReason: matchResult.bestMatchReason,
      bestResume: tailoringPerformed && tailoredResume ? tailoredResume : bestResume,

      // Tailoring feature fields
      tailoringPerformed,
      originalMatchPercentage: bestScore,
      tailoredMatchPercentage,
      latexCode,
      originalResume: bestResume,             // reference to the original
      supabasePublicUrl: supabasePublicUrl || null,  // signed URL (1-hour expiry) for the tailored PDF
      atsReport: tailoringPerformed ? (tailoringResult?.atsReport || null) : null,
      pdfDeferred: !!(deferPdfGeneration && tailoringPerformed),
      rewrittenContent: tailoringPerformed ? rewrittenContent : null,
      originalData: tailoringPerformed ? originalDataSnapshot : null,
      tailoredData: tailoringPerformed ? tailoredDataSnapshot : null,
      collegeTierInfo: tailoringPerformed ? collegeTierInfo : null,
    });
  } catch (err) {
    if (isCancelled(signal, err)) {
      console.log('🚫 Resume matching cancelled by user.');
      return;
    }
    console.error('❌ Resume matching error:', err.message);
    if (!res.writableEnded) return res.status(500).json({ error: `Failed to match resumes: ${err.message}` });
  }
}

// ── SSE Progress Stream ──────────────────────────────────────────────────────
// Holds references to all connected SSE clients so other parts of this
// controller can push progress events via emitProgress().
const sseClients = new Map();

function progressStream(req, res) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (nginx)
  res.flushHeaders();

  // Send a heartbeat so the client knows the stream is open
  res.write('data: {"type":"connected"}\n\n');

  // Register this client
  const userId = req.user.uid;
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);

  // Remove when the client disconnects
  req.on('close', () => {
    const clients = sseClients.get(userId);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) sseClients.delete(userId);
  });
}

// Call this from anywhere in this controller to push a step update to all clients
function emitProgress(userId, step, status, detail = null) {
  const payload = JSON.stringify({ step, status, detail });
  const clients = sseClients.get(userId);
  if (!clients) return;
  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (_) {
      clients.delete(client);
    }
  }
}

// ── Resume format list ───────────────────────────────────────────────────────
function getResumeFormats(req, res) {
  return res.json({ success: true, formats: listResumeFormats() });
}

// ── Preview resume in a chosen format (no AI, pdflatex only) ─────────────────
async function previewResumeFormat(req, res) {
  const { formatId, originalData, rewrittenSections, highlightKeywords, jobData, collegeTierInfo } = req.body;

  if (!formatId || !originalData || !rewrittenSections) {
    return res.status(400).json({ error: 'formatId, originalData, and rewrittenSections are required.' });
  }

  try {
    const keywords = highlightKeywords?.length
      ? highlightKeywords
      : collectJdKeywords(jobData);
    const filenameBase = `preview_${formatId}_${Date.now()}`;
    const pdfBuffer = await generateTailoredResumePdf(
      req.user.uid,
      originalData,
      rewrittenSections,
      filenameBase,
      { formatId, highlightKeywords: keywords, collegeTierInfo }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filenameBase}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Format-Id', formatId);
    if (req.body.tailoredMatchPercentage != null) {
      res.setHeader('X-Tailored-Match-Percentage', String(req.body.tailoredMatchPercentage));
    }
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('❌ Preview PDF error:', err.message);
    return res.status(500).json({ error: `Failed to generate preview: ${err.message}` });
  }
}

// ── Generate final tailored PDF after user picks a format (returns PDF only — not saved) ──
async function generateTailoredPdf(req, res) {
  const { formatId, originalData, rewrittenSections, jobData, tailoredData, jobTitle, collegeTierInfo, tailoredMatchPercentage: clientScore } = req.body;

  if (!formatId || !originalData || !rewrittenSections) {
    return res.status(400).json({ error: 'formatId, originalData, and rewrittenSections are required.' });
  }

  const signal = abortSignalForRequest(req, res);

  try {
    const safeJobTitle = (jobTitle || jobData?.jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g, '_');
    const filenameBase = `tailored_resume_${safeJobTitle}_${Date.now()}`;
    const highlightKeywords = collectJdKeywords(jobData);

    emitProgress(req.user.uid, 'compile_pdf', 'running', `Compiling resume (${formatId})...`);
    const pdfBuffer = await generateTailoredResumePdf(
      req.user.uid,
      originalData,
      rewrittenSections,
      filenameBase,
      { formatId, highlightKeywords, collegeTierInfo }
    );
    emitProgress(req.user.uid, 'compile_pdf', 'done', 'PDF compiled successfully.');

    let tailoredMatchPercentage = clientScore ?? null;
    if (tailoredMatchPercentage == null && jobData && tailoredData && !signal.aborted) {
      tailoredMatchPercentage = await geminiService.scoreTailoredResume(jobData, tailoredData, {
        signal,
        baselineScore: req.body.originalMatchPercentage,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    if (tailoredMatchPercentage != null) {
      res.setHeader('X-Tailored-Match-Percentage', String(tailoredMatchPercentage));
    }
    res.setHeader('X-Format-Id', formatId);
    return res.send(pdfBuffer);
  } catch (err) {
    if (isCancelled(signal, err)) return;
    console.error('❌ Generate tailored PDF error:', err.message);
    return res.status(500).json({ error: `Failed to generate PDF: ${err.message}` });
  }
}

module.exports = {
  analyzeJob,
  parseJd,
  matchResumes,
  progressStream,
  emitProgress,
  getResumeFormats,
  previewResumeFormat,
  generateTailoredPdf,
};
