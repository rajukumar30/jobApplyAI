const path = require('path');
const gmailService = require('../services/gmail/gmailService');
const applicationStore = require('../services/applicationStore');

// ── Generate Email ───────────────────────────────────────────────────────────
async function generateEmail(req, res) {
  const { jobData, resumeData } = req.body;

  if (!jobData || !resumeData) {
    return res.status(400).json({ error: 'Both jobData and resumeData are required.' });
  }
  if (!jobData.jobTitle || !jobData.company) {
    return res.status(400).json({ error: 'jobData must include jobTitle and company.' });
  }

  try {
    const geminiService = require('../services/gemini/geminiService');
    console.log(`🤖 Generating email for ${jobData.jobTitle} at ${jobData.company}...`);
    const email = await geminiService.generateEmail(jobData, resumeData);
    return res.json({ success: true, subject: email.subject, body: email.body });
  } catch (err) {
    console.error('❌ Email generation error:', err.message);
    return res.status(500).json({ error: `Failed to generate email: ${err.message}` });
  }
}

// ── Send Email via Gmail SMTP ────────────────────────────────────────────────
async function sendEmail(req, res) {
  const {
    to,
    subject,
    body,
    senderName,
    resumeFilename,
    resumeStoragePath,
    resumeOriginalName,
    // Application metadata for duplicate tracking
    company,
    role,
  } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: `Invalid recipient email: ${to}` });
  }

  // We now pass the filename/path down; gmailService will fetch from Supabase Storage
  let attachmentName = null;
  if (resumeFilename) {
    attachmentName = resumeOriginalName || resumeFilename;
  }

  try {
    console.log(`📧 Sending email to ${to} via Gmail SMTP...`);
    const result = await gmailService.sendEmail(req.user.uid, {
      to,
      subject,
      body,
      senderName,
      resumeFilename,
      resumeStoragePath, // exact path in Supabase Storage
      attachmentName
    });

    // ── Save application record after successful send ─────────────────────
    const savedEntry = await applicationStore.saveApplication(req.user.uid, {
      company:  company  || 'Unknown Company',
      role:     role     || 'Unknown Role',
      email:    to,
      resume:   resumeOriginalName || resumeFilename || null,
    });

    return res.json({
      success: true,
      messageId: result.messageId,
      message: `Email sent successfully to ${to}`,
      applicationSaved: savedEntry,
    });
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    return res.status(500).json({ error: `Failed to send email: ${err.message}` });
  }
}

module.exports = { generateEmail, sendEmail };
