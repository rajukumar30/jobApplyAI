const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { supabase } = require('../supabase/supabaseService');

// ── Create SMTP transporter using Gmail App Password ─────────────────────────
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'Gmail SMTP not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env'
    );
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: { user, pass },
  });
}

// ── Check if SMTP is configured ──────────────────────────────────────────────
function isConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// ── Verify SMTP connection ───────────────────────────────────────────────────
async function verifyConnection() {
  const transporter = createTransporter();
  await transporter.verify();
  return true;
}

// ── Send email via Gmail SMTP ────────────────────────────────────────────────
/**
 * @param {{ to, subject, body, senderName, resumeFilename, resumeStoragePath, attachmentName }} opts
 */
async function sendEmail({ to, subject, body, senderName, resumeFilename, resumeStoragePath, attachmentName }) {
  const transporter = createTransporter();
  const from = process.env.GMAIL_USER;

  // Use candidate name if provided, otherwise fallback to the first part of the email address
  const defaultName = from.split('@')[0];
  const displayName = senderName ? senderName : defaultName;

  const mailOptions = {
    from: `"${displayName}" <${from}>`,
    to,
    subject,
    text: body,
    attachments: [],
  };

  // Attach resume PDF from Supabase Storage or local fallback
  if (resumeFilename) {
    let attached = false;
    const targetPath = resumeStoragePath || resumeFilename;

    if (supabase && resumeStoragePath) {
      const bucketName = resumeFilename.startsWith('tailored_') ? 'tailored-resumes' : 'resumes';
      console.log(`☁️ Fetching resume from Supabase Storage (${bucketName}): ${targetPath}`);

      const { data, error } = await supabase.storage.from(bucketName).download(targetPath);

      if (!error && data) {
        // Convert Blob/File data to Buffer for nodemailer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        mailOptions.attachments.push({
          filename: attachmentName || resumeFilename,
          content: buffer,
          contentType: 'application/pdf',
        });
        console.log(`📎 Attached resume from Supabase: ${attachmentName || resumeFilename}`);
        attached = true;
      } else {
        console.warn(`⚠️ Resume not found in Supabase Storage: ${targetPath} (${error?.message || 'Unknown error'})`);
      }
    }

    if (!attached) {
      // Fallback to local filesystem if Supabase isn't configured or file wasn't found
      // Check generated-resumes for tailored resumes, then resumes for originals
      const localPaths = [
        path.join(__dirname, '../../generated-resumes', resumeFilename),
        path.join(__dirname, '../../resumes', resumeFilename)
      ];

      for (const localPath of localPaths) {
        if (fs.existsSync(localPath)) {
          mailOptions.attachments.push({
            filename: attachmentName || resumeFilename,
            path: localPath,
            contentType: 'application/pdf',
          });
          console.log(`📎 Attached resume from local storage: ${localPath}`);
          attached = true;
          break;
        }
      }

      if (!attached) {
        console.warn(`⚠️ Resume not found locally: ${resumeFilename}`);
      }
    }
  }

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email sent! Message ID: ${info.messageId}`);
  return { messageId: info.messageId, status: 'sent' };
}

module.exports = { isConfigured, verifyConnection, sendEmail };
