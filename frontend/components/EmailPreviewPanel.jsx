import { useState, useEffect } from 'react';
import axios from 'axios';
import { StepRow } from './AIPipelineProgress';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function EmailPreviewPanel({ jobData, matchResult, gmailConnected, steps = [], onSent }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [genError, setGenError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [verifyResult, setVerifyResult] = useState('');

  const bestResume = matchResult?.bestResume;
  const recruiterEmail = jobData?.jobData?.recruiterEmail || jobData?.recruiterEmail || '';
  const emailStep = steps.find(s => s.id === 'email');

  // Reset state when a new job is analyzed
  useEffect(() => {
    setSubject('');
    setBody('');
    setRecipientEmail(recruiterEmail || '');
    setGenError('');
    setSendError('');
    setSendSuccess('');
    setVerifyResult('');
  }, [jobData]); // Dependency on jobData ensures reset when it changes

  const handleGenerate = async () => {
    if (!jobData) { setGenError('Please analyze a job description first.'); return; }
    if (!bestResume) { setGenError('No resume selected. Upload resumes and analyze a job first.'); return; }

    setGenerating(true);
    setGenError('');
    setSendSuccess('');

    try {
      const res = await axios.post(`${API}/email/generate`, {
        jobData: jobData.jobData || jobData,
        resumeData: bestResume,
      });
      setSubject(res.data.subject || '');
      setBody(res.data.body || '');
    } catch (err) {
      setGenError(err.response?.data?.error || 'Failed to generate email. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerifySmtp = async () => {
    setVerifying(true);
    setVerifyResult('');
    try {
      await axios.post(`${API}/gmail/verify`);
      setVerifyResult('success');
    } catch (err) {
      setVerifyResult(err.response?.data?.error || 'SMTP connection failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setSendError('Email subject and body are required.'); return; }
    if (!recipientEmail.trim()) { setSendError('Recipient email address is required.'); return; }
    if (!gmailConnected) { setSendError('Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env and restart the server.'); return; }

    setSending(true);
    setSendError('');
    setSendSuccess('');

    try {
      const jd = jobData?.jobData || jobData || {};
      const senderName = bestResume?.parsedData?.name || '';
      const res = await axios.post(`${API}/email/send`, {
        to: recipientEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        senderName: senderName,
        resumeFilename: bestResume?.filename,
        resumeStoragePath: bestResume?.firebaseStoragePath, // pass exact storage path
        resumeOriginalName: bestResume?.originalName,
        // For application history tracking
        company: jd.company || '',
        role:    jd.jobTitle || '',
      });
      setSendSuccess(`✅ Email sent to ${recipientEmail}! Message ID: ${res.data.messageId}`);
      onSent?.(); // Trigger history refresh
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send email. Check SMTP config.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-6 slide-up">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon bg-rose-600/20 text-rose-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-base">Email Preview</h2>
          <p className="text-xs text-slate-400">AI-generated application email — editable before sending</p>
        </div>

        {/* SMTP Status Badge */}
        <div className="flex items-center gap-2">
          {gmailConnected ? (
            <div className="flex items-center gap-2">
              <span className="badge-green flex items-center gap-1.5">
                <span className="status-dot bg-emerald-400 animate-pulse" />
                Gmail SMTP Ready
              </span>
              <button
                onClick={handleVerifySmtp}
                disabled={verifying}
                className="btn-secondary text-xs px-3 py-1.5"
                title="Test SMTP connection"
              >
                {verifying ? '...' : '🔌 Test'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="badge-red flex items-center gap-1.5">
                <span className="status-dot bg-red-400" />
                SMTP Not Set
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Email Pipeline Step — only show while generating */}
      {generating && emailStep && (
        <div className="mb-5">
          <StepRow step={emailStep} />
        </div>
      )}

      {/* SMTP Not Configured Warning */}
      {!gmailConnected && (
        <div className="mb-5 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl fade-in">
          <p className="text-amber-300 text-sm font-semibold mb-2">⚠️ Gmail SMTP not configured</p>
          <p className="text-amber-200/70 text-xs leading-relaxed mb-3">
            Add these two values to your <code className="bg-navy-900/60 px-1.5 py-0.5 rounded text-amber-300">.env</code> file and restart the backend:
          </p>
          <div className="bg-navy-900/60 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
            <p><span className="text-brand-400">GMAIL_USER</span>=you@gmail.com</p>
            <p><span className="text-brand-400">GMAIL_APP_PASSWORD</span>=xxxx xxxx xxxx xxxx</p>
          </div>
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Generate App Password at myaccount.google.com/apppasswords ↗
          </a>
        </div>
      )}

      {/* SMTP verify result */}
      {verifyResult && verifyResult !== 'success' && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-xs fade-in">
          ❌ {verifyResult}
        </div>
      )}
      {verifyResult === 'success' && (
        <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs fade-in">
          ✅ SMTP connection verified! Ready to send.
        </div>
      )}

      {/* Generate Button */}
      <div className="flex items-center gap-3 mb-5">
        <button
          id="generate-email-btn"
          onClick={handleGenerate}
          disabled={generating || !jobData || !bestResume}
          className="btn-primary"
        >
          {generating ? (
            <><LoadingSpinner size="sm" /> Generating...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Email with AI
            </>
          )}
        </button>
        {bestResume && (
          <p className="text-xs text-slate-500">
            Resume: <span className="text-brand-400">{bestResume.parsedData?.name || bestResume.originalName}</span>
          </p>
        )}
        {(!jobData || !bestResume) && (
          <p className="text-xs text-slate-500">
            {!jobData ? '⚠️ Analyze a job first' : '⚠️ Upload resumes first'}
          </p>
        )}
      </div>

      {genError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm fade-in">
          {genError}
        </div>
      )}

      {/* Email Form */}
      {(subject || body) && (
        <div className="space-y-4 fade-in">
          {/* Recipient */}
          <div>
            <label className="section-label" htmlFor="recipient-email">To (Recipient Email)</label>
            <input
              id="recipient-email"
              type="email"
              className="form-input"
              placeholder="recruiter@company.com"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
            />
            {!recruiterEmail && (
              <p className="text-xs text-amber-500 mt-1.5">
                ⚠️ No recruiter email found in job post. Please enter it manually.
              </p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="section-label" htmlFor="email-subject">Subject</label>
            <input
              id="email-subject"
              type="text"
              className="form-input"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="section-label mb-0" htmlFor="email-body">Email Body</label>
              <span className="text-xs text-slate-500">{body.length} chars</span>
            </div>
            <textarea
              id="email-body"
              className="form-textarea h-64 font-mono text-xs leading-relaxed"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          {/* Attachment */}
          {bestResume && (
            <div className="flex items-center gap-2 p-3 bg-navy-900/40 rounded-xl border border-white/5">
              <span className="text-red-400">📎</span>
              <span className="text-sm text-slate-300">
                Attachment: <span className="text-brand-400 font-medium">{bestResume.originalName}</span>
              </span>
              <span className="ml-auto badge-blue text-xs">Auto-attached</span>
            </div>
          )}

          {gmailConnected && (
            <p className="text-xs text-slate-500">
              📤 Sending via Gmail SMTP
            </p>
          )}

          {sendError && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm fade-in">
              {sendError}
            </div>
          )}
          {sendSuccess && (
            <div className="p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm fade-in">
              {sendSuccess}
            </div>
          )}

          {/* Send Button */}
          <button
            id="send-email-btn"
            onClick={handleSend}
            disabled={sending || !gmailConnected || !subject.trim() || !body.trim() || !recipientEmail.trim()}
            className="btn-success w-full justify-center"
          >
            {sending ? (
              <><LoadingSpinner size="sm" /> Sending via Gmail SMTP...</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Email {bestResume ? '+ Resume' : ''}
              </>
            )}
          </button>

          {!gmailConnected && (
            <p className="text-center text-xs text-slate-500">
              Add GMAIL_USER + GMAIL_APP_PASSWORD to .env to enable sending
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!subject && !body && !generating && (
        <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-900/20 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">No email generated yet</p>
          <p className="text-slate-500 text-xs mt-1">Analyze a job and match resumes, then click "Generate Email with AI"</p>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <svg className={`${s} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
