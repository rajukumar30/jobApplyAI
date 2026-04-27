const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const geminiService = require('../services/gemini/geminiService');
const { supabase } = require('../services/supabase/supabaseService');

const RESUME_STORE_PATH = path.join(__dirname, '../data/resumeStore.json');
const RESUMES_DIR = path.join(__dirname, '../resumes');

// Helpers for local fallback
function readLocalStore() {
  try {
    return JSON.parse(fs.readFileSync(RESUME_STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalStore(data) {
  fs.writeFileSync(RESUME_STORE_PATH, JSON.stringify(data, null, 2));
}

// Export readStore for jobController
async function readStore() {
  if (!supabase) {
    return readLocalStore();
  }
  try {
    const { data, error } = await supabase.from('resumes').select('*').order('uploadedAt', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Supabase read error (resumes):', err.message);
    return readLocalStore();
  }
}

// ── Upload Resumes ───────────────────────────────────────────────────────────
async function uploadResumes(req, res) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No PDF files uploaded.' });
  }

  const results = [];
  const errors = [];
  let localStore = readLocalStore();

  for (const file of req.files) {
    try {
      console.log(`📄 Processing resume: ${file.originalname}`);

      // Extract text from temporary local PDF
      const pdfBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(pdfBuffer);
      const rawText = pdfData.text;

      if (!rawText || rawText.trim().length < 50) {
        errors.push({ file: file.originalname, error: 'PDF appears to be empty or unreadable' });
        fs.unlinkSync(file.path);
        continue;
      }

      // Parse with AI
      console.log(`🤖 Parsing resume with Gemini: ${file.originalname}`);
      const parsedData = await geminiService.parseResume(rawText);

      let storageUrl = null;

      // Upload to Supabase Storage
      if (supabase) {
        console.log(`☁️  Uploading ${file.filename} to Supabase Storage...`);
        const destFileName = `${Date.now()}_${file.filename}`;

        const { data, error } = await supabase.storage
          .from('resumes')
          .upload(destFileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (error) {
           console.error('Supabase storage upload error:', error.message);
           // Fallback to local
        } else {
           storageUrl = data.path;
        }
      }

      const resumeEntry = {
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        rawText, // Store full text
        parsedData,
        firebaseStoragePath: storageUrl // keeping the same property name so frontend/other code doesn't break
      };

      // Save to Supabase DB
      if (supabase && storageUrl) {
        const { data, error } = await supabase.from('resumes').insert([resumeEntry]).select();
        if (error) throw error;

        resumeEntry.id = data[0].id;
        console.log(`✅ Resume saved to Supabase: ${parsedData.name || 'Unknown'}`);

        // Clean up local temp file since we have it in Supabase
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } else {
        resumeEntry.id = `resume_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        console.log(`✅ Resume saved locally: ${parsedData.name || 'Unknown'}`);
        localStore.push(resumeEntry);
        // Do NOT delete the file because we need it locally for attachments
      }

      results.push(resumeEntry);

    } catch (err) {
      console.error(`❌ Error processing ${file.originalname}:`, err.message);
      errors.push({ file: file.originalname, error: err.message });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  }

  if (!supabase || results.some(r => !r.firebaseStoragePath)) {
    writeLocalStore(localStore);
  }

  return res.json({
    success: true,
    uploaded: results.length,
    errors: errors.length,
    resumes: results.map(({ rawText, ...r }) => r), // Don't send rawText back to UI
    errorDetails: errors,
  });
}

// ── List Resumes ─────────────────────────────────────────────────────────────
async function listResumes(req, res) {
  const store = await readStore();
  const safe = store.map(({ rawText, ...r }) => r);
  return res.json({ resumes: safe });
}

// ── Delete Resume ────────────────────────────────────────────────────────────
async function deleteResume(req, res) {
  const { filename } = req.params;
  if (!filename) return res.status(400).json({ error: 'Filename is required.' });

  const store = await readStore();
  const entry = store.find(r => r.filename === filename);

  if (!entry) {
    return res.status(404).json({ error: 'Resume not found in store.' });
  }

  try {
    // Delete from Supabase Storage (select correct bucket)
    if (supabase && entry.firebaseStoragePath) {
      const bucketName = entry.isTailored ? 'tailored-resumes' : 'resumes';
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([entry.firebaseStoragePath]);

      if (error) {
        console.error(`Supabase storage delete error (${bucketName}):`, error.message);
      } else {
        console.log(`🗑️  Deleted file from Supabase Storage (${bucketName}): ${entry.firebaseStoragePath}`);
      }
    }

    // Delete from Supabase Database
    if (supabase && entry.id && !entry.id.startsWith('resume_')) {
      const { error } = await supabase.from('resumes').delete().eq('id', entry.id);
      if (error) throw error;
      console.log(`🗑️  Deleted document from Supabase DB: ${entry.id}`);
    }

    // Local Fallback Cleanup
    if (!supabase || (entry.id && entry.id.startsWith('resume_'))) {
      const localFilePath = path.join(RESUMES_DIR, filename);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      let localStore = readLocalStore();
      localStore = localStore.filter(r => r.filename !== filename);
      writeLocalStore(localStore);
    }

    return res.json({ success: true, message: `Resume "${entry.originalName}" deleted.` });
  } catch (error) {
    console.error('Delete error (resume):', error.message);
    return res.status(500).json({ error: `Failed to delete resume: ${error.message}` });
  }
}

// ── Download Resume ──────────────────────────────────────────────────────────
async function downloadResume(req, res) {
  const { filename } = req.params;
  const isTailored = req.query.isTailored === 'true';

  if (!filename) return res.status(400).json({ error: 'Filename is required.' });

  const store = await readStore();
  let entry = store.find(r => r.filename === filename);

  // For tailored resumes not found in DB, check local store as fallback
  if (!entry && isTailored) {
    const localStore = readLocalStore();
    entry = localStore.find(r => r.filename === filename);
  }

  const displayName = entry?.originalName || filename;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(displayName)}"`);

  try {
    // 1. Try Supabase Storage first
    if (supabase && entry?.firebaseStoragePath) {
      const bucketName = isTailored ? 'tailored-resumes' : 'resumes';
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(entry.firebaseStoragePath);

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
      }
      console.warn(`⚠️ Could not download from Supabase Storage: ${error?.message}`);
    }

    // 2. Fallback to Local Storage
    const localDir = isTailored ? path.join(__dirname, '../generated-resumes') : RESUMES_DIR;
    const localFilePath = path.join(localDir, filename);

    if (fs.existsSync(localFilePath)) {
      // If Supabase is available but file wasn't uploaded yet, upload it now
      if (supabase && isTailored && (!entry || !entry.firebaseStoragePath)) {
        try {
          const pdfBuffer = fs.readFileSync(localFilePath);
          const { error: bucketError } = await supabase.storage.createBucket('tailored-resumes', {
            public: false,
            fileSizeLimit: 10485760
          });
          if (bucketError && !bucketError.message.includes('already exists')) {
            console.error('Bucket creation error:', bucketError.message);
          }

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tailored-resumes')
            .upload(filename, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true
            });

          if (!uploadError && uploadData) {
            console.log(`✅ Uploaded missing tailored resume to Supabase: ${uploadData.path}`);
            // Update the DB entry with the storage path
            if (entry && entry.id && !String(entry.id).startsWith('tailored_')) {
              await supabase.from('resumes').update({ firebaseStoragePath: uploadData.path }).eq('id', entry.id);
            }
          } else if (uploadError) {
            console.error('⚠️ Failed to upload tailored resume on-demand:', uploadError.message);
          }
        } catch (uploadErr) {
          console.error('⚠️ On-demand upload error:', uploadErr.message);
        }
      }

      const fileStream = fs.createReadStream(localFilePath);
      return fileStream.pipe(res);
    }

    // 3. For tailored resumes, also try Supabase directly by filename even without a store entry
    if (supabase && isTailored) {
      const { data, error } = await supabase.storage
        .from('tailored-resumes')
        .download(filename);

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
      }
    }

    if (!res.headersSent) {
      return res.status(404).json({ error: 'File not found in storage.' });
    }
  } catch (error) {
    console.error('Download error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to download resume.' });
    }
  }
}

module.exports = { uploadResumes, listResumes, deleteResume, downloadResume, readStore };