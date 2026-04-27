const path = require('path');
const fs = require('fs');
const geminiService = require('../services/gemini/geminiService');
const linkedinService = require('../services/linkedin/linkedinService');
const applicationStore = require('../services/applicationStore');
const resumeController = require('./resumeController');
const { generateTailoredResumePdf } = require('../services/pdf/latexService');
const { supabase } = require('../services/supabase/supabaseService');
const fakeJobDetectionService = require('../services/fakeJobDetectionService');

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
      const linkedinToken = linkedinService.getLinkedInToken();
      if (linkedinToken) {
        const authResult = await linkedinService.fetchJobPageAuthenticated(url, linkedinToken.access_token);
        if (authResult.success) {
          description = authResult.description;
          source = 'linkedin_authenticated';
        } else {
          return res.status(401).json({
            error: 'LinkedIn login required to access this job post.',
            requiresLinkedInLogin: true,
            authUrl: linkedinService.getAuthUrl(),
          });
        }
      } else {
        return res.status(401).json({
          error: 'LinkedIn login required to access this job post.',
          requiresLinkedInLogin: true,
          authUrl: linkedinService.getAuthUrl(),
        });
      }
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

  try {
    console.log(`🤖 Analyzing job with Gemini (source: ${source})...`);
    
    // Concurrently run regular analysis and fake job detection (if requested)
    const analysisPromise = geminiService.analyzeJob(description);
    
    let fakeJobPromise = Promise.resolve(null);
    if (detectFakeJob) {
      console.log(`🛡️ Fake job detection requested. Extracting data...`);
      fakeJobPromise = geminiService.extractLinkedInPostData(description)
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
      const previousApplications = await applicationStore.checkDuplicate(jobData.company);
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
    console.error('❌ Job analysis error:', err.message);
    return res.status(500).json({ error: `Failed to analyze job: ${err.message}` });
  }
}

// ── Match Resumes ────────────────────────────────────────────────────────────
async function matchResumes(req, res) {
  const { jobData } = req.body;

  if (!jobData) {
    return res.status(400).json({ error: 'Job data is required for resume matching.' });
  }

  const resumes = await resumeController.readStore();
  // Filter out already tailored resumes so we don't match against them
  const originalResumes = resumes.filter(r => !r.isTailored);

  if (originalResumes.length === 0) {
    return res.status(404).json({ error: 'No original resumes found. Please upload at least one resume.' });
  }

  try {
    console.log(`🤖 Matching ${originalResumes.length} original resume(s) with Gemini...`);
    const matchResult = await geminiService.matchResumes(jobData, originalResumes);

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

    emitProgress('match_resume', 'done', `Matched ${originalResumes.length} resume(s). Best score: ${matchResult.rankings[0]?.score ?? '?'}%`);

    let tailoringPerformed = false;
    let tailoredResume = null;
    let tailoredMatchPercentage = null;
    let latexCode = null;
    let supabasePublicUrl = null;  // signed URL for the tailored PDF (set when Supabase upload succeeds)
    let tailoringResult = null;    // full result including atsReport

    // ── AI Resume Tailoring (if score < 80) ──────────────────────────────────
    emitProgress('score', 'running', 'Evaluating resume match quality...');
    if (bestScore < 80 && bestResume) {
      console.log(`⚠️ Best match score is ${bestScore}%. Initiating AI Resume Tailoring...`);
      try {
        tailoringPerformed = true;
        emitProgress('score', 'done', `Best match: ${bestScore}% — tailoring resume for better fit...`);

        // 1. ATS keyword gap analysis + tailoring (2-stage pipeline inside geminiService)
        emitProgress('tailor', 'running', 'Stage 1: Extracting ATS keywords & running gap analysis...');
        tailoringResult = await geminiService.tailorResume(jobData, bestResume);
        let tailoredData = tailoringResult.tailoredData;
        const rewrittenSections = tailoringResult.rewrittenContent;
        const atsReport = tailoringResult.atsReport || {};

        if (!tailoredData || !rewrittenSections) {
          throw new Error('AI returned an invalid response missing tailored data.');
        }

        // 2. Build PDF using the fixed LaTeX template (falls back to pdfmake if pdflatex unavailable)
        // IMPORTANT: Pass originalData + rewrittenSections separately so the template
        // uses original data for locked fields and AI content only for the 4 editable placeholders.
        const injected = (atsReport.missingKeywordsInjected || []).length;
        emitProgress('tailor', 'done', `Stage 2: ATS optimization complete — ${injected} missing keywords injected.`);
        emitProgress('compile_pdf', 'running', 'Compiling ATS-optimized resume to PDF...');
        const originalData = bestResume.parsedData || {};
        const safeJobTitle = (jobData.jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g, '_');
        const filenameBase = `tailored_resume_${safeJobTitle}_${Date.now()}`;
        const pdfBuffer = await generateTailoredResumePdf(originalData, rewrittenSections, filenameBase);
        emitProgress('compile_pdf', 'done', 'PDF compiled successfully.');

        // 3. Upload tailored PDF to Supabase Storage
        let firebaseStoragePath = null;
        if (supabase) {
          emitProgress('upload', 'running', 'Uploading tailored PDF to cloud storage...');
          const destFileName = `${filenameBase}.pdf`;
          console.log(`☁️ Uploading tailored resume to Supabase Storage: tailored-resumes/${destFileName}...`);

          // Ensure the tailored-resumes bucket exists
          const { error: bucketError } = await supabase.storage.createBucket('tailored-resumes', {
            public: false,
            fileSizeLimit: 10485760
          });
          if (bucketError && !bucketError.message.includes('already exists')) {
            console.error('❌ Failed to create tailored-resumes bucket:', bucketError.message);
          }

          const { data, error } = await supabase.storage
            .from('tailored-resumes')
            .upload(destFileName, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true
            });

          if (error) {
            console.error('❌ Failed to upload tailored resume to Supabase:', error.message);
            emitProgress('upload', 'warn', 'Cloud upload failed — using local fallback.');
          } else {
            firebaseStoragePath = data.path;
            console.log(`✅ Tailored resume uploaded successfully.`);
            emitProgress('upload', 'done', 'Tailored resume uploaded to cloud.');

            // Generate a signed URL (valid for 1 hour) so caller can access the PDF
            const { data: signedData, error: signedError } = await supabase.storage
              .from('tailored-resumes')
              .createSignedUrl(destFileName, 3600);

            if (signedError) {
              console.warn('⚠️ Could not generate signed URL:', signedError.message);
            } else {
              supabasePublicUrl = signedData.signedUrl;
              console.log(`🔗 Supabase signed URL generated (expires in 1 hour)`);
            }
          }
        }


        // 4. Re-evaluate the new score
        console.log('🤖 Re-evaluating tailored resume score...');
        tailoredMatchPercentage = await geminiService.scoreTailoredResume(jobData, tailoredData);
        console.log(`📈 New score after tailoring: ${tailoredMatchPercentage}%`);
        emitProgress('email', 'done', `✅ Ready! New match score: ${tailoredMatchPercentage}%`);

        // 5. Construct tailored resume object
        tailoredResume = {
          id: `tailored_${Date.now()}`,
          filename: `${filenameBase}.pdf`,
          originalName: `Tailored Resume for ${jobData.jobTitle}.pdf`,
          fileSize: pdfBuffer.length,
          uploadedAt: new Date().toISOString(),
          parsedData: tailoredData,
          firebaseStoragePath, // Still using this key for compatibility with emailController
          isTailored: true
        };

        // 6. Save tailored resume metadata to Supabase DB so it appears in the UI
        let dbSaved = false;
        if (supabase) {
          const { data, error } = await supabase.from('resumes').insert([{
            ...tailoredResume,
            id: undefined // Let Supabase auto-generate the UUID
          }]).select();

          if (error) {
            console.error('❌ Failed to save tailored resume metadata to Supabase DB:', error.message);
            console.error('Hint: Make sure the "resumes" table has an "isTailored" boolean column!');
          } else if (data && data.length > 0) {
            tailoredResume.id = data[0].id;
            console.log('✅ Tailored resume metadata saved to Supabase DB.');
            dbSaved = true;
          }
        }

        // Fallback: If DB save failed or Supabase not configured, save locally
        if (!dbSaved) {
          console.log('⚠️ Saving tailored resume locally as fallback.');
          const localStorePath = path.join(__dirname, '../data/resumeStore.json');
          try {
            const localStore = fs.existsSync(localStorePath) ? JSON.parse(fs.readFileSync(localStorePath, 'utf8')) : [];
            localStore.push(tailoredResume);
            fs.writeFileSync(localStorePath, JSON.stringify(localStore, null, 2));
            console.log('✅ Tailored resume metadata saved to local fallback store.');
          } catch (localErr) {
            console.error('❌ Failed to save to local store:', localErr.message);
          }
        }

      } catch (err) {
        console.error('❌ Tailoring pipeline failed:', err.message);
        // Fallback to original resume if tailoring fails
        tailoringPerformed = false;
        tailoredResume = null;
      }
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
      atsReport: tailoringPerformed ? (tailoringResult?.atsReport || null) : null  // ATS keyword injection report
    });
  } catch (err) {
    console.error('❌ Resume matching error:', err.message);
    return res.status(500).json({ error: `Failed to match resumes: ${err.message}` });
  }
}

// ── SSE Progress Stream ──────────────────────────────────────────────────────
// Holds references to all connected SSE clients so other parts of this
// controller can push progress events via emitProgress().
const sseClients = new Set();

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
  sseClients.add(res);

  // Remove when the client disconnects
  req.on('close', () => {
    sseClients.delete(res);
  });
}

// Call this from anywhere in this controller to push a step update to all clients
function emitProgress(step, status, detail = null) {
  const payload = JSON.stringify({ step, status, detail });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

module.exports = { analyzeJob, matchResumes, progressStream, emitProgress };
