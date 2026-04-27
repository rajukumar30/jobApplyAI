import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function JobInputPanel({ onJobAnalyzed, onJobAnalysisStarted, onLinkedInAuthRequired, onAnalyzeRequest, isLoading = false }) {
  const [tab, setTab] = useState('text'); // 'text' | 'url'
  const [jobText, setJobText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [urlFetching, setUrlFetching] = useState(false);
  const [fetchedDescription, setFetchedDescription] = useState('');
  const [detectFakeJob, setDetectFakeJob] = useState(false);

  const handleFetchUrl = async () => {
    if (!jobUrl.trim()) return;
    setUrlFetching(true);
    setError('');
    try {
      const res = await axios.post(`${API}/linkedin/fetch-job`, { url: jobUrl.trim() });
      if (res.data.success) {
        setFetchedDescription(res.data.description);
        setTab('text');
        setJobText(res.data.description);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresLinkedInLogin) {
        onLinkedInAuthRequired?.(data.authUrl);
        setError('LinkedIn login required. Click "Login with LinkedIn" to continue.');
      } else {
        setError(data?.error || 'Failed to fetch job page. Please paste the description manually.');
      }
    } finally {
      setUrlFetching(false);
    }
  };

  const handleAnalyze = async () => {
    const text = jobText.trim();
    const url = jobUrl.trim();

    if (!text && !url) {
      setError('Please paste a job description or enter a LinkedIn URL.');
      return;
    }
    if (text && text.length < 50) {
      setError('Job description seems too short. Please provide a full description.');
      return;
    }

    setError('');
    const payload = { ...(text ? { text } : { url }), detectFakeJob };

    // If the parent provides onAnalyzeRequest, delegate entirely (apply page flow)
    if (onAnalyzeRequest) {
      onAnalyzeRequest(payload);
      return;
    }

    // Fallback: original inline behavior
    onJobAnalysisStarted?.();
    setLoading(true);

    try {
      const res = await axios.post(`${API}/job/analyze`, payload);
      onJobAnalyzed?.(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresLinkedInLogin) {
        onLinkedInAuthRequired?.(data.authUrl);
        setError('LinkedIn login required to access this job post.');
      } else {
        setError(data?.error || 'Failed to analyze job. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 slide-up">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon bg-brand-600/20 text-brand-400">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-white text-base">Job Input</h2>
          <p className="text-xs text-slate-400">Paste a description or enter a LinkedIn URL</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-navy-900/60 p-1 rounded-xl w-fit">
        {[
          { id: 'text', label: 'Paste Description' },
          { id: 'url', label: 'LinkedIn URL' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Text Input */}
      {tab === 'text' && (
        <div className="space-y-3 fade-in">
          <p className="section-label">Job Description</p>
          <textarea
            id="job-description-textarea"
            className="form-textarea h-48"
            placeholder="Paste the full job description here...&#10;&#10;Include requirements, responsibilities, and company info for best results."
            value={jobText}
            onChange={e => setJobText(e.target.value)}
          />
          <p className="text-xs text-slate-500 text-right">{jobText.length} characters</p>
        </div>
      )}

      {/* URL Input */}
      {tab === 'url' && (
        <div className="space-y-3 fade-in">
          <p className="section-label">LinkedIn Job URL</p>
          <div className="flex gap-2">
            <input
              id="linkedin-url-input"
              type="url"
              className="form-input flex-1"
              placeholder="https://www.linkedin.com/jobs/view/..."
              value={jobUrl}
              onChange={e => setJobUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
            />
            <button
              id="fetch-url-btn"
              onClick={handleFetchUrl}
              disabled={urlFetching || !jobUrl.trim()}
              className="btn-secondary px-4 flex-shrink-0"
            >
              {urlFetching ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" /> Fetching
                </span>
              ) : 'Fetch'}
            </button>
          </div>

          {fetchedDescription && (
            <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-xl">
              <p className="text-xs text-emerald-400 font-medium mb-1">✅ Job description extracted</p>
              <p className="text-xs text-slate-400 line-clamp-3">{fetchedDescription.slice(0, 200)}...</p>
            </div>
          )}

          {/* LinkedIn OAuth Fallback */}
          <div className="flex items-center gap-3 mt-2">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-xs text-slate-500">or if blocked</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          <a
            id="linkedin-login-btn"
            href={`${API}/linkedin/auth`}
            className="btn-secondary w-full justify-center text-center"
          >
            <LinkedInIcon />
            Login with LinkedIn
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm fade-in">
          {error}
        </div>
      )}

      {/* Fake Job Checkbox */}
      <div className="mt-5 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded border-white/10 bg-navy-900/50 text-brand-500 focus:ring-brand-500 focus:ring-offset-navy-900" 
            checked={detectFakeJob}
            onChange={(e) => setDetectFakeJob(e.target.checked)}
          />
          Detect Fake Job (LinkedIn)
        </label>
        {detectFakeJob && <span className="badge-blue text-[10px] py-0.5">Beta</span>}
      </div>

      {/* Analyze Button */}
      <button
        id="analyze-job-btn"
        onClick={handleAnalyze}
        disabled={loading || isLoading || (!jobText.trim() && !jobUrl.trim())}
        className="btn-primary w-full mt-5 justify-center"
      >
        {(loading || isLoading) ? (
          <><LoadingSpinner size="sm" /> Analyzing... (Local AI may take 2-5 mins)</>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Analyze Job with AI
          </>
        )}
      </button>
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

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  );
}
