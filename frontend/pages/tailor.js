import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import PageLayout from '../components/layout/PageLayout';
import JDUploadPanel from '../components/JDUploadPanel';
import ResumeUploadPanel from '../components/ResumeUploadPanel';
import AnalysisProgressModal from '../components/AnalysisProgressModal';
import { useApp } from '../lib/AppContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const TAILOR_STEPS = [
  { id: 'parse_jd', label: '📄 Reading job description', status: 'idle', detail: null },
  { id: 'analyze_job', label: '🔍 Analyzing job requirements', status: 'idle', detail: null },
  { id: 'match_resume', label: '🏆 Scoring your resumes (ATS)', status: 'idle', detail: null },
  { id: 'tailor', label: '✨ Tailoring best resume', status: 'idle', detail: null },
  { id: 'compile_pdf', label: '📄 Generating tailored PDF', status: 'idle', detail: null },
  { id: 'upload', label: '☁️ Saving tailored resume', status: 'idle', detail: null },
];

export default function TailorPage() {
  const router = useRouter();
  const {
    user, authLoading,
    resumes, resumes_loading, handleResumeUploaded, loadResumes,
    setTailorJobResult, setTailorMatchResult,
    showToast,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState(TAILOR_STEPS);
  const abortRef = useRef(null);

  const setStep = useCallback((id, patch) => {
    setPipelineSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setModalOpen(false);
    showToast('info', 'Tailoring cancelled.');
  }, [showToast]);

  const originalResumes = resumes.filter(r => !r.isTailored);

  const handleTailor = useCallback(async ({ text, sourceFile }) => {
    if (originalResumes.length === 0) {
      showToast('error', 'Upload at least one resume before tailoring.');
      return;
    }

    setModalOpen(true);
    const controller = new AbortController();
    abortRef.current = controller;

    setPipelineSteps(TAILOR_STEPS.map((s, i) =>
      i === 0 ? { ...s, status: 'running', detail: sourceFile ? `Parsed ${sourceFile}` : 'Using pasted text' } : s
    ));

    try {
      setStep('parse_jd', { status: 'done', detail: sourceFile ? `From file: ${sourceFile}` : 'From pasted text' });

      setStep('analyze_job', { status: 'running', detail: 'Extracting role, skills, requirements…' });
      const jobRes = await axios.post(`${API}/job/analyze`, { text }, { signal: controller.signal, timeout: 120000 });
      const jobResult = jobRes.data;
      setStep('analyze_job', {
        status: 'done',
        detail: `${jobResult.jobData?.jobTitle || 'Role'} at ${jobResult.jobData?.company || 'Company'}`,
      });

      setStep('match_resume', {
        status: 'running',
        detail: `ATS scoring ${originalResumes.length} resume(s)…`,
      });

      const matchRes = await axios.post(`${API}/job/match-resumes`, {
        jobData: jobResult.jobData,
        forceTailor: true,
      }, { signal: controller.signal, timeout: 300000 });

      const data = matchRes.data;
      const topScore = data.originalMatchPercentage ?? data.rankings?.[0]?.score;

      setStep('match_resume', {
        status: 'done',
        detail: `Best match: ${topScore}% — ${data.bestResume?.parsedData?.name || data.bestResume?.originalName || 'resume'}`,
      });

      if (!data.tailoringPerformed) {
        ['tailor', 'compile_pdf', 'upload'].forEach(id =>
          setStep(id, { status: 'error', detail: 'Tailoring did not complete. Try again.' })
        );
        showToast('error', 'Tailoring did not complete. Please try again.');
        return;
      }

      setStep('tailor', { status: 'done', detail: 'Resume rewritten for this job.' });
      setStep('compile_pdf', {
        status: 'done',
        detail: data.bestResume?.originalName || 'PDF ready',
      });
      setStep('upload', {
        status: data.supabasePublicUrl ? 'done' : 'warn',
        detail: data.supabasePublicUrl ? 'Saved to cloud storage.' : 'Saved locally.',
      });

      // Store in AppContext (memory + sessionStorage) before navigating — same
      // pattern as the apply → analysis flow so results are always available.
      setTailorJobResult(jobResult);
      setTailorMatchResult(data);
      loadResumes();

      await new Promise(r => setTimeout(r, 800));
      setModalOpen(false);
      await router.push('/tailor-results');

    } catch (err) {
      if (axios.isCancel(err) || err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      const msg = err.response?.data?.error || err.message || 'Tailoring failed. Please try again.';
      setPipelineSteps(prev => prev.map(s =>
        s.status === 'running' ? { ...s, status: 'error', detail: msg } : s
      ));
      showToast('error', msg);
    } finally {
      abortRef.current = null;
    }
  }, [originalResumes, setStep, showToast, router, setTailorJobResult, setTailorMatchResult, loadResumes]);

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
    <PageLayout title="Tailor Resume from JD" showBack backHref="/" backLabel="Dashboard">
      <div className="page-hero">
        <h1>Tailor Resume from Job Description</h1>
        <p>Upload or paste a job description. AI scores all your resumes and creates an ATS-optimized version you can download.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <JDUploadPanel onTailorRequest={handleTailor} disabled={originalResumes.length === 0} />
        <ResumeUploadPanel onUploaded={handleResumeUploaded} />
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Your Resumes</h3>
          <span className="badge-blue text-xs">{originalResumes.length} available</span>
        </div>
        {resumes_loading ? (
          <p className="text-slate-500 text-sm">Loading resumes…</p>
        ) : originalResumes.length === 0 ? (
          <p className="text-amber-300 text-sm">Upload at least one PDF resume on the right to get started.</p>
        ) : (
          <ul className="space-y-2">
            {originalResumes.map(r => (
              <li key={r.filename} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-red-400 text-xs font-bold">PDF</span>
                <span className="truncate">{r.parsedData?.name || r.originalName}</span>
                {r.parsedData?.idealRole && (
                  <span className="text-xs text-slate-500 ml-auto flex-shrink-0">{r.parsedData.idealRole}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnalysisProgressModal
        isOpen={modalOpen}
        steps={pipelineSteps}
        onCancel={handleCancel}
      />
    </PageLayout>
  );
}
