import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

import PageLayout from '../components/layout/PageLayout';
import JobInputPanel from '../components/JobInputPanel';
import ResumeUploadPanel from '../components/ResumeUploadPanel';
import AnalysisProgressModal from '../components/AnalysisProgressModal';
import { useApp } from '../lib/AppContext';
import { INITIAL_STEPS } from '../lib/AppContext';

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

export default function ApplyPage() {
  const router = useRouter();
  const {
    user, authLoading,
    resumes, handleResumeUploaded,
    setJobResult, setMatchResult, setDuplicateWarning,
    pipelineSteps, setPipelineSteps, setStep,
    showToast,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const abortRef = useRef(null);

  // Cancel the in-flight analysis — aborts the request, which the backend
  // detects (client disconnect) and uses to stop the Gemini pipeline server-side.
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setModalOpen(false);
    showToast('info', 'Analysis cancelled.');
  }, [showToast]);

  // Kick off the full analysis pipeline
  const handleAnalyze = useCallback(async (payload) => {
    setModalOpen(true);

    // Fresh AbortController for this run so Cancel can stop it.
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset pipeline
    const freshSteps = INITIAL_STEPS.map((s, i) =>
      i === 0 ? { ...s, status: 'running', detail: 'Extracting requirements with Gemini…' } : s
    );
    setPipelineSteps(freshSteps);
    setJobResult(null);
    setMatchResult(null);
    setDuplicateWarning(null);

    try {
      // ── Step 1: Analyze job ─────────────────────────────────────────────
      const jobRes = await axios.post(`${API}/job/analyze`, payload, { signal: controller.signal });
      const result = jobRes.data;

      setJobResult(result);

      const dupWarning = result.duplicateWarning || null;
      setDuplicateWarning(dupWarning);

      setStep('analyze_job', {
        status: 'done',
        detail: `${result.jobData?.jobTitle || 'Role'} at ${result.jobData?.company || 'Company'}`,
      });

      if (dupWarning) {
        showToast('info', `⚠️ Already applied to ${result.jobData?.company} before!`, 5000);
      }

      if (resumes.length === 0) {
        // No resumes — mark remaining steps as skipped
        ['match_resume', 'score', 'tailor', 'compile_pdf', 'upload'].forEach(id =>
          setStep(id, { status: 'idle', detail: 'Upload a resume to activate this step.' })
        );
        setStep('email', { status: 'done', detail: 'Generate a personalized email below.' });
        setTimeout(() => { setModalOpen(false); router.push('/analysis'); }, 800);
        return;
      }

      // ── Step 2: Match resumes ───────────────────────────────────────────
      setStep('match_resume', {
        status: 'running',
        detail: `Comparing ${resumes.length} resume(s) against job requirements…`,
      });

      const matchRes = await axios.post(`${API}/job/match-resumes`, {
        jobData: result.jobData,
      }, { signal: controller.signal });

      const topScore = matchRes.data.originalMatchPercentage ?? matchRes.data.rankings?.[0]?.score;
      const tailored = matchRes.data.tailoringPerformed;

      setStep('match_resume', {
        status: 'done',
        detail: `Best resume: ${matchRes.data.bestResume?.parsedData?.name || matchRes.data.bestResume?.originalName || 'Unknown'}`,
      });

      // ── Step 3: Score ───────────────────────────────────────────────────
      setStep('score', {
        status: topScore < 80 ? 'warn' : 'done',
        score: topScore,
        detail: topScore < 80
          ? `Score ${topScore}% is below 80% — AI tailoring triggered.`
          : `Strong match! Score ${topScore}% — no tailoring needed.`,
        isWarning: topScore < 80,
      });

      // ── Steps 4-6: Tailor, Compile, Upload ─────────────────────────────
      if (tailored) {
        setStep('tailor', { status: 'done', detail: 'Summary, skills, experience rewritten.' });
        setStep('compile_pdf', {
          status: matchRes.data.bestResume?.filename?.endsWith('.pdf') ? 'done' : 'warn',
          detail: matchRes.data.bestResume?.filename?.endsWith('.pdf')
            ? `PDF generated — ${matchRes.data.bestResume.originalName}`
            : 'PDF generated via fallback renderer.',
        });
        setStep('upload', {
          status: matchRes.data.supabasePublicUrl ? 'done' : 'warn',
          detail: matchRes.data.supabasePublicUrl
            ? 'Uploaded to Supabase Storage — URL ready.'
            : 'Saved locally (Supabase upload skipped).',
        });
      } else {
        ['tailor', 'compile_pdf', 'upload'].forEach(id =>
          setStep(id, { status: 'done', detail: 'Skipped — resume already scores ≥80%.' })
        );
      }

      setStep('email', { status: 'done', detail: 'Ready to generate a personalized email.' });

      setMatchResult(matchRes.data);

      // Brief pause to let user see the completed state, then navigate
      await new Promise(r => setTimeout(r, 900));
      setModalOpen(false);
      router.push('/analysis');

    } catch (err) {
      // User cancelled — request was aborted; stay quiet (handleCancel handles UI).
      if (axios.isCancel(err) || err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
        return;
      }

      const data = err.response?.data;
      const msg = data?.error || 'Analysis failed. Please try again.';

      // Mark the currently-running step as error
      setPipelineSteps(prev => prev.map(s =>
        s.status === 'running' ? { ...s, status: 'error', detail: msg } : s
      ));
      showToast('error', msg);
    } finally {
      abortRef.current = null;
    }
  }, [resumes, setJobResult, setMatchResult, setDuplicateWarning, setPipelineSteps, setStep, showToast, router]);

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) {
    router.replace('/');
    return null;
  }

  return (
    <PageLayout title="Apply with JD / LinkedIn Post" showBack backHref="/" backLabel="Dashboard">
      <StepFlow current={1} />

      {/* Hero */}
      <div className="page-hero">
        <h1>Apply with JD / LinkedIn Post</h1>
        <p>Paste a job description or LinkedIn URL, upload your resume, and let AI do the heavy lifting.</p>
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left — Job Input */}
        <JobInputPanel
          onJobAnalysisStarted={() => {}} // handled inline in handleAnalyze
          onJobAnalyzed={() => {}} // we take over the flow here
          onAnalyzeRequest={handleAnalyze}
          onLinkedInAuthRequired={(authUrl) => {
            showToast('info', '🔗 LinkedIn login required. Redirecting…');
            setTimeout(() => { window.location.href = authUrl; }, 1500);
          }}
        />

        {/* Right — Resume Upload */}
        <ResumeUploadPanel onUploaded={handleResumeUploaded} />
      </div>

      {/* Hint when no analysis has been run yet */}
      {resumes.length === 0 && (
        <div className="glass-card p-5 border-l-2 border-amber-500/50 fade-in">
          <p className="text-amber-300 text-sm font-medium mb-1">⚠️ No resumes uploaded</p>
          <p className="text-slate-400 text-xs">Upload at least one PDF resume on the right so AI can match and potentially tailor it for this job.</p>
        </div>
      )}

      {/* Analysis Progress Modal */}
      <AnalysisProgressModal
        isOpen={modalOpen}
        steps={pipelineSteps}
        onCancel={handleCancel}
      />
    </PageLayout>
  );
}
