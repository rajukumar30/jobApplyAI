import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useApp } from '../lib/AppContext';
import PageLayout from '../components/layout/PageLayout';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Step flow indicator
function StepFlow({ current }) {
  const steps = ['Apply', 'Analysis', 'Email'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const isDone = idx < current;
        const isActive = idx === current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={isActive ? 'step-dot-active' : isDone ? 'step-dot-done' : 'step-dot-idle'}>
                {isDone ? '✓' : idx}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${isDone ? 'bg-gradient-to-r from-emerald-500/40 to-brand-500/40' : 'bg-white/5'}`} />
            )}
          </div>
        );
      })}
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

export default function EmailPage() {
  const router = useRouter();
  const {
    user, authLoading,
    jobResult, matchResult,
    gmailConnected, connectGmail, triggerHistoryRefresh, showToast,
  } = useApp();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [genError, setGenError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState('');

  const bestResume = matchResult?.bestResume;
  const recruiterEmail = jobResult?.jobData?.recruiterEmail || jobResult?.recruiterEmail || '';

  // Auto-generate email on mount if we have the required data and haven't already
  useEffect(() => {
    if (jobResult && bestResume && !subject && !body) {
      handleGenerate();
    }
    setRecipientEmail(recruiterEmail || '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!jobResult) { setGenError('No job analyzed. Please go back and analyze a job first.'); return; }
    setGenerating(true);
    setGenError('');
    setSendSuccess('');
    try {
      const res = await axios.post(`${API}/email/generate`, {
        jobData: jobResult.jobData || jobResult,
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

  const handleVerifyGmail = async () => {
    setVerifying(true);
    setVerifyResult('');
    try {
      await axios.post(`${API}/gmail/verify`);
      setVerifyResult('success');
    } catch (err) {
      setVerifyResult(err.response?.data?.error || 'Gmail connection failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setSendError('Email subject and body are required.'); return; }
    if (!recipientEmail.trim()) { setSendError('Recipient email address is required.'); return; }
    if (!gmailConnected) { setSendError('Connect your Gmail account before sending.'); return; }

    setSending(true);
    setSendError('');
    setSendSuccess('');

    try {
      const jd = jobResult?.jobData || jobResult || {};
      const res = await axios.post(`${API}/email/send`, {
        to: recipientEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        senderName: bestResume?.parsedData?.name || '',
        resumeFilename: bestResume?.filename,
        resumeStoragePath: bestResume?.firebaseStoragePath,
        resumeOriginalName: bestResume?.originalName,
        company: jd.company || '',
        role: jd.jobTitle || '',
      });
      setSendSuccess(`✅ Email sent to ${recipientEmail}! Message ID: ${res.data.messageId}`);
      triggerHistoryRefresh();
      showToast('success', `✅ Application sent to ${jd.company || recipientEmail}!`);
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send email. Check your Gmail connection.');
    } finally {
      setSending(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );

  if (!user) { router.replace('/'); return null; }
  if (!jobResult) { router.replace('/apply'); return null; }

  const jd = jobResult?.jobData || jobResult || {};

  return (
    <PageLayout title="Send Application Email" showBack backHref="/analysis" backLabel="Analysis">
      <StepFlow current={3} />

      {/* Hero */}
      <div className="page-hero">
        <h1>Send Application Email</h1>
        <p>Review and edit the AI-generated email before sending to the recruiter.</p>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Email card */}
        <div className="glass-card p-6 slide-up space-y-5">
          {/* Header */}
          <div className="panel-header">
            <div className="panel-icon bg-rose-600/20 text-rose-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-white text-base">Application Email</h2>
              <p className="text-xs text-slate-400">
                {jd.jobTitle && jd.company ? `${jd.jobTitle} at ${jd.company}` : 'AI-generated, editable before sending'}
              </p>
            </div>
            {/* SMTP status */}
            <div className="flex items-center gap-2">
              {gmailConnected ? (
                <>
                  <span className="badge-green flex items-center gap-1.5 text-xs">
                    <span className="status-dot bg-emerald-400 animate-pulse" />
                    Gmail Ready
                  </span>
                  <button onClick={handleVerifyGmail} disabled={verifying} className="btn-secondary text-xs px-3 py-1.5">
                    {verifying ? '…' : '🔌 Test'}
                  </button>
                </>
              ) : (
                <span className="badge-red flex items-center gap-1.5 text-xs">
                  <span className="status-dot bg-red-400" />
                  Gmail Not Connected
                </span>
              )}
            </div>
          </div>

          {/* Verify result */}
          {verifyResult && verifyResult !== 'success' && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-xs fade-in">❌ {verifyResult}</div>
          )}
          {verifyResult === 'success' && (
            <div className="p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs fade-in">Gmail connection verified.</div>
          )}

          {/* SMTP warning */}
          {!gmailConnected && (
            <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl fade-in">
              <p className="text-amber-300 text-sm font-semibold mb-2">Connect Gmail to send from your own account.</p>
              <button onClick={connectGmail} className="btn-primary text-xs">Connect Gmail</button>
            </div>
          )}

          {/* Generating */}
          {generating && (
            <div className="flex items-center gap-3 py-4 text-slate-400 text-sm">
              <LoadingSpinner />
              <span>Generating email with AI…</span>
            </div>
          )}

          {genError && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm fade-in">{genError}</div>
          )}

          {/* Re-generate button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating || !jobResult}
              className="btn-secondary text-xs"
              id="regenerate-email-btn"
            >
              {generating ? <><LoadingSpinner size="sm" /> Generating…</> : '⚡ Re-generate with AI'}
            </button>
            {bestResume && (
              <p className="text-xs text-slate-500">
                Resume: <span className="text-brand-400">{bestResume.parsedData?.name || bestResume.originalName}</span>
              </p>
            )}
          </div>

          {/* Email form */}
          {(subject || body) && !generating && (
            <div className="space-y-4 fade-in">
              {/* Recipient */}
              <div>
                <label className="section-label" htmlFor="email-recipient">To (Recipient Email)</label>
                <input
                  id="email-recipient"
                  type="email"
                  className="form-input"
                  placeholder="recruiter@company.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                />
                {!recruiterEmail && (
                  <p className="text-xs text-amber-500 mt-1.5">⚠️ No recruiter email found in job post — enter it manually.</p>
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

              {/* Attachment badge */}
              {bestResume && (
                <div className="flex items-center gap-2 p-3 bg-navy-900/40 rounded-xl border border-white/5">
                  <span className="text-red-400">📎</span>
                  <span className="text-sm text-slate-300">
                    Attachment: <span className="text-brand-400 font-medium">{bestResume.originalName}</span>
                  </span>
                  <span className="ml-auto badge-blue text-xs">Auto-attached</span>
                </div>
              )}

              {sendError && (
                <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm fade-in">{sendError}</div>
              )}

              {/* Success banner */}
              {sendSuccess && (
                <div className="p-4 bg-emerald-900/30 border border-emerald-500/40 rounded-xl fade-in">
                  <p className="text-emerald-300 font-semibold text-sm mb-2">{sendSuccess}</p>
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => router.push('/')} className="btn-secondary text-xs">
                      ← Back to Dashboard
                    </button>
                    <button onClick={() => router.push('/history')} className="btn-secondary text-xs">
                      View History
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom action buttons */}
        {!sendSuccess && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => router.push('/analysis')} className="btn-secondary">
              ← Cancel
            </button>
            <button
              id="send-email-btn"
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || !recipientEmail.trim()}
              className="btn-success px-8 justify-center"
            >
              {sending ? (
                <><LoadingSpinner size="sm" /> Sending…</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Email{bestResume ? ' + Resume' : ''}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
