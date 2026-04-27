import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useApp } from '../lib/AppContext';
import axios from 'axios';

import PageLayout from '../components/layout/PageLayout';
import JobInputPanel from '../components/JobInputPanel';
import ResumeUploadPanel from '../components/ResumeUploadPanel';
import AnalysisProgressModal from '../components/AnalysisProgressModal';

// 5-minute timeout — Gemini 2.5-flash can take 60-90s for complex prompts
const AXIOS_TIMEOUT = 5 * 60 * 1000;

export default function ApplyPage() {
  const router = useRouter();
  const {
    user, authLoading,
    resumes,
    setJobResult, setMatchResult, setDuplicateWarning, setFakeJobResult,
    pipelineSteps, setStep, resetFlow,
    handleResumeUploaded,
    API,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const sseRef = useRef(null);

  // Auth guard — useEffect only so auth state changes never unmount during processing
  useEffect(() => {
    if (!authLoading && !user) router.replace('/');
  }, [user, authLoading, router]);

  const closeModal = () => {
    setModalOpen(false);
    setIsProcessing(false);
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
  };

  const handleJobAnalyze = async ({ text, url, detectFakeJob } = {}) => {
    if (isProcessing) return; // prevent double-clicks
    resetFlow();
    setModalOpen(true);
    setIsProcessing(true);

    // ── Step 1: Analyze job ───────────────────────────────────────────────
    setStep('analyze_job', {
      status: 'running',
      detail: 'Sending to Gemini AI — this may take 20-40 seconds...',
    });

    try {
      const { data: result } = await axios.post(
        `${API}/job/analyze`,
        { text, url, detectFakeJob },
        { timeout: AXIOS_TIMEOUT }
      );

      setJobResult(result.jobData);
      setDuplicateWarning(result.duplicateWarning || null);
      setFakeJobResult(result.fakeJobAnalysis || null);

      setStep('analyze_job', {
        status: 'done',
        detail: `${result.jobData?.jobTitle || 'Role'} at ${result.jobData?.company || 'Company'}`,
      });

      if (resumes.length === 0) {
        ['match_resume', 'score', 'tailor', 'compile_pdf', 'upload'].forEach(id =>
          setStep(id, { status: 'idle', detail: 'Upload a resume to activate this step.' })
        );
        setStep('email', { status: 'done', detail: 'Generate a personalized email below.' });
        setTimeout(() => { setModalOpen(false); router.push('/analysis'); }, 800);
        return;
      }

      // ── Open SSE progress stream ─────────────────────────────────────────
      if (sseRef.current) sseRef.current.close();
      const sse = new EventSource(`${API}/job/progress`);
      sseRef.current = sse;
      sse.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.step) setStep(data.step, { status: data.status, detail: data.detail });
        } catch (_) {}
      };
      sse.onerror = () => sse.close();

      // ── Step 2: Match + tailor resumes ───────────────────────────────────
      setStep('match_resume', {
        status: 'running',
        detail: `Comparing ${resumes.length} resume(s) — AI tailoring may take 60-90 seconds...`,
      });

      const matchRes = await axios.post(
        `${API}/job/match-resumes`,
        { jobData: result.jobData },
        { timeout: AXIOS_TIMEOUT }
      );

      sse.close();
      sseRef.current = null;
      setMatchResult(matchRes.data);

      setTimeout(() => { setModalOpen(false); router.push('/analysis'); }, 1500);

    } catch (err) {
      console.error('Pipeline error:', err);
      const msg = err.code === 'ECONNABORTED'
        ? 'Request timed out — the AI is under heavy load. Please try again.'
        : err.response?.data?.error || err.message || 'Failed to complete pipeline.';
      setStep('analyze_job', { status: 'error', detail: msg });
      ['match_resume', 'score', 'tailor', 'compile_pdf', 'upload', 'email'].forEach(id =>
        setStep(id, { status: 'idle', detail: null })
      );
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading spinner while auth resolves
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  return (
    <PageLayout title="Apply">
      <div className="page-hero">
        <h1>Start Application</h1>
        <p>1. Analyze the job &nbsp; 2. Match your resumes &nbsp; 3. AI tailors the best fit</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6 mb-12">
        <JobInputPanel
          onAnalyzeRequest={handleJobAnalyze}
          isLoading={isProcessing}
        />

        <AnalysisProgressModal
          isOpen={modalOpen}
          steps={pipelineSteps}
          onCancel={closeModal}
        />
      </div>

      <div className="max-w-4xl mx-auto">
        <h2 className="section-label mb-4">Your Resume Library</h2>
        <ResumeUploadPanel onUploaded={handleResumeUploaded} />
      </div>
    </PageLayout>
  );
}
