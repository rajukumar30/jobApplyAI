const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { db } = require('../firebase/firebaseService');
const { supabase } = require('../supabase/supabaseService');
const { getUserResumeDir, getUserGeneratedDir } = require('../userStorage');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const STATE_TTL_MS = 10 * 60 * 1000;

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/gmail/callback';
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getStateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret === 'jobapply-ai-session-secret') {
    throw new Error('Set a strong OAUTH_STATE_SECRET or SESSION_SECRET before using Gmail OAuth.');
  }
  return secret;
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getStateSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(state) {
  const [encoded, signature] = String(state || '').split('.');
  if (!encoded || !signature) throw new Error('Invalid OAuth state.');

  const expected = crypto.createHmac('sha256', getStateSecret()).update(encoded).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new Error('Invalid OAuth state signature.');
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload.uid || !payload.expiresAt || Date.now() > payload.expiresAt) {
    throw new Error('OAuth state expired.');
  }
  return payload;
}

function getAuthUrl(user) {
  const oauth2Client = getOAuthClient();
  const state = signState({
    uid: user.uid,
    email: user.email || null,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_SCOPE, 'openid', 'email'],
    state,
    login_hint: user.email || undefined,
  });
}

function getIntegrationRef(userId) {
  if (!db) throw new Error('Firebase is required for per-user Gmail connections.');
  return db.collection('users').doc(userId).collection('integrations').doc('gmail');
}

async function saveConnection(userId, data) {
  await getIntegrationRef(userId).set({
    ...data,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function getConnection(userId) {
  if (!db) return null;
  const snapshot = await getIntegrationRef(userId).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function exchangeCode(state, code) {
  const payload = verifyState(state);
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const existing = await getConnection(payload.uid);

  await saveConnection(payload.uid, {
    email: profile.data.emailAddress,
    tokens: {
      ...existing?.tokens,
      ...tokens,
      refresh_token: tokens.refresh_token || existing?.tokens?.refresh_token,
    },
    connected: true,
  });

  return { userId: payload.uid, email: profile.data.emailAddress };
}

// Store a Google OAuth access token obtained from the client-side sign-in popup
// (which carries the gmail.send scope). These tokens are short-lived and have
// no refresh token, so they are refreshed by re-running the popup.
//
// Note: we intentionally do NOT call gmail.users.getProfile here — that method
// is not authorized by the narrow gmail.send scope. The sender address comes
// from the verified Firebase ID token (the account the user signed in with).
async function saveTokenConnection(userId, accessToken, email) {
  if (!accessToken) throw new Error('Missing Google access token.');

  const existing = await getConnection(userId);
  const senderEmail = email || existing?.email || null;

  // The login popup yields only a short-lived access token (no refresh token).
  // Firestore rejects undefined values, so only include refresh_token if a
  // prior server-side connection actually provided one.
  const tokens = {
    ...existing?.tokens,
    access_token: accessToken,
  };
  if (existing?.tokens?.refresh_token) {
    tokens.refresh_token = existing.tokens.refresh_token;
  } else {
    delete tokens.refresh_token;
  }

  await saveConnection(userId, {
    email: senderEmail,
    tokens,
    tokenObtainedAt: Date.now(),
    connected: true,
    method: tokens.refresh_token ? 'oauth' : 'oauth_token',
  });

  return { userId, email: senderEmail };
}

async function disconnect(userId) {
  const connection = await getConnection(userId);
  if (connection?.tokens) {
    try {
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials(connection.tokens);
      await oauth2Client.revokeCredentials();
    } catch (error) {
      console.warn('Gmail token revocation failed:', error.message);
    }
  }
  if (db) await getIntegrationRef(userId).delete();
}

async function getAuthorizedClient(userId) {
  const connection = await getConnection(userId);
  if (!connection?.connected || !connection.tokens) return null;
  const tokens = connection.tokens;

  // Server-side OAuth connection with a long-lived refresh token.
  if (tokens.refresh_token) {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);
    oauth2Client.on('tokens', async (newTokens) => {
      await saveConnection(userId, {
        tokens: {
          ...tokens,
          ...newTokens,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
        },
        connected: true,
      });
    });
    return { oauth2Client, connection };
  }

  // Login-popup connection: short-lived access token only (no refresh). Treat
  // as expired after ~55 minutes so the UI prompts the user to reconnect.
  const obtainedAt = connection.tokenObtainedAt || 0;
  if (!tokens.access_token || Date.now() - obtainedAt > 55 * 60 * 1000) {
    return null;
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: tokens.access_token });
  return { oauth2Client, connection };
}

async function getStatus(userId) {
  const authorized = await getAuthorizedClient(userId);
  if (authorized) {
    return { connected: true, email: authorized.connection.email, method: 'oauth' };
  }

  const sharedSmtpEnabled = process.env.ALLOW_SHARED_SMTP === 'true';
  const sharedSmtpReady = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  if (sharedSmtpEnabled && sharedSmtpReady) {
    return { connected: true, email: process.env.GMAIL_USER, method: 'shared_smtp' };
  }

  return { connected: false, email: null, method: 'oauth' };
}

async function verifyConnection(userId) {
  const authorized = await getAuthorizedClient(userId);
  if (authorized) {
    const gmail = google.gmail({ version: 'v1', auth: authorized.oauth2Client });
    await gmail.users.getProfile({ userId: 'me' });
    return true;
  }

  if (process.env.ALLOW_SHARED_SMTP === 'true' && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.verify();
    return true;
  }

  throw new Error('Connect your Gmail account first.');
}

async function resolveAttachment(userId, resumeFilename, resumeStoragePath, attachmentName) {
  if (!resumeFilename) return null;

  if (supabase && resumeStoragePath) {
    if (!resumeStoragePath.startsWith(`${userId}/`)) {
      throw new Error('Resume attachment does not belong to the authenticated user.');
    }
    const bucketName = resumeFilename.startsWith('tailored_') ? 'tailored-resumes' : 'resumes';
    const { data, error } = await supabase.storage.from(bucketName).download(resumeStoragePath);
    if (!error && data) {
      return {
        filename: attachmentName || resumeFilename,
        content: Buffer.from(await data.arrayBuffer()),
        contentType: 'application/pdf',
      };
    }
  }

  const localPaths = [
    path.join(getUserGeneratedDir(userId), resumeFilename),
    path.join(getUserResumeDir(userId), resumeFilename),
  ];
  const localPath = localPaths.find(candidate => fs.existsSync(candidate));
  if (!localPath) return null;

  return {
    filename: attachmentName || resumeFilename,
    path: localPath,
    contentType: 'application/pdf',
  };
}

async function sendEmail(userId, options) {
  const {
    to,
    subject,
    body,
    senderName,
    resumeFilename,
    resumeStoragePath,
    attachmentName,
  } = options;

  const attachment = await resolveAttachment(
    userId,
    resumeFilename,
    resumeStoragePath,
    attachmentName
  );
  const attachments = attachment ? [attachment] : [];
  const authorized = await getAuthorizedClient(userId);

  if (authorized) {
    const connTokens = authorized.connection.tokens || {};
    const authOptions = connTokens.refresh_token
      ? {
          type: 'OAuth2',
          user: authorized.connection.email,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: connTokens.refresh_token,
          accessToken: connTokens.access_token,
        }
      : {
          type: 'OAuth2',
          user: authorized.connection.email,
          accessToken: connTokens.access_token,
        };
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: authOptions,
    });
    const info = await transporter.sendMail({
      from: `"${senderName || authorized.connection.email.split('@')[0]}" <${authorized.connection.email}>`,
      to,
      subject,
      text: body,
      attachments,
    });
    return { messageId: info.messageId, status: 'sent' };
  }

  if (process.env.ALLOW_SHARED_SMTP === 'true' && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const info = await transporter.sendMail({
      from: `"${senderName || process.env.GMAIL_USER.split('@')[0]}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: body,
      attachments,
    });
    return { messageId: info.messageId, status: 'sent' };
  }

  throw new Error('Connect your Gmail account before sending an application.');
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  saveTokenConnection,
  getStatus,
  verifyConnection,
  disconnect,
  sendEmail,
};
