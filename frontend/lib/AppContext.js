import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, googleProvider, signInWithPopup, signOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const AppContext = createContext(null);

// ── sessionStorage helpers ───────────────────────────────────────────────────
function saveSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}
function loadSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function clearSession(...keys) {
  keys.forEach(k => { try { sessionStorage.removeItem(k); } catch (_) {} });
}

// ── Pipeline step definitions ─────────────────────────────────────────────────
export const INITIAL_STEPS = [
  { id: 'analyze_job',  label: '🔍 Analyzing job description',     status: 'idle', detail: null },
  { id: 'match_resume', label: '🏆 Matching resumes to job',        status: 'idle', detail: null },
  { id: 'score',        label: '📊 Scoring resume match quality',   status: 'idle', detail: null },
  { id: 'tailor',       label: '✨ AI tailoring resume content',    status: 'idle', detail: null },
  { id: 'compile_pdf',  label: '📄 Compiling LaTeX resume PDF',     status: 'idle', detail: null },
  { id: 'upload',       label: '☁️  Uploading to Supabase Storage', status: 'idle', detail: null },
  { id: 'email',        label: '✉️  Ready to send email',           status: 'idle', detail: null },
];

export function AppProvider({ children }) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Global data ───────────────────────────────────────────────────────────
  const [resumes, setResumes] = useState([]);
  const [resumes_loading, setResumesLoading] = useState(true);
  const [gmailConnected, setGmailConnected] = useState(false);

  // ── Flow state (hydrated from sessionStorage) ─────────────────────────────
  const [jobResult, setJobResultState] = useState(() => loadSession('app_jobResult'));
  const [matchResult, setMatchResultState] = useState(() => loadSession('app_matchResult'));
  const [fakeJobResult, setFakeJobResultState] = useState(() => loadSession('app_fakeJobResult'));
  const [duplicateWarning, setDuplicateWarning] = useState(() => loadSession('app_duplicateWarning'));
  const [pipelineSteps, setPipelineSteps] = useState(INITIAL_STEPS);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);

  // History refresh
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // ── Wrapped setters that also persist ────────────────────────────────────
  const setJobResult = useCallback((val) => {
    setJobResultState(val);
    saveSession('app_jobResult', val);
  }, []);

  const setMatchResult = useCallback((val) => {
    setMatchResultState(val);
    saveSession('app_matchResult', val);
  }, []);

  const setFakeJobResult = useCallback((val) => {
    setFakeJobResultState(val);
    saveSession('app_fakeJobResult', val);
  }, []);

  const setDupWarning = useCallback((val) => {
    setDuplicateWarning(val);
    saveSession('app_duplicateWarning', val);
  }, []);

  const resetFlow = useCallback(() => {
    setJobResultState(null);
    setMatchResultState(null);
    setFakeJobResultState(null);
    setDuplicateWarning(null);
    setPipelineSteps(INITIAL_STEPS);
    clearSession('app_jobResult', 'app_matchResult', 'app_fakeJobResult', 'app_duplicateWarning');
  }, []);

  // ── step updater helper ──────────────────────────────────────────────────
  const setStep = useCallback((id, patch) => {
    setPipelineSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      loadResumes();
      checkGmailStatus();
    }
  }, [user]);

  // ── API helpers ───────────────────────────────────────────────────────────
  const loadResumes = async () => {
    setResumesLoading(true);
    try {
      const res = await axios.get(`${API}/resumes`);
      setResumes(res.data.resumes || []);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    } finally {
      setResumesLoading(false);
    }
  };

  const checkGmailStatus = async () => {
    try {
      const res = await axios.get(`${API}/gmail/status`);
      setGmailConnected(res.data.connected);
    } catch (_) {}
  };

  // ── Auth actions ──────────────────────────────────────────────────────────
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { showToast('error', 'Login failed. Please try again.'); }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setResumes([]);
      resetFlow();
    } catch (_) {}
  };

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((type, message, duration = 4000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  // ── Resume actions ────────────────────────────────────────────────────────
  const handleResumeUploaded = useCallback((newResumes) => {
    setResumes(prev => {
      const existing = new Set(prev.map(r => r.filename));
      const fresh = newResumes.filter(r => !existing.has(r.filename));
      return [...prev, ...fresh];
    });
    showToast('success', `✅ ${newResumes.length} resume(s) uploaded and parsed!`);
  }, [showToast]);

  const handleResumeDeleted = useCallback((filename) => {
    setResumes(prev => prev.filter(r => r.filename !== filename));
    if (matchResult?.bestResume?.filename === filename) setMatchResult(null);
    showToast('info', '🗑 Resume deleted.');
  }, [matchResult, setMatchResult, showToast]);

  return (
    <AppContext.Provider value={{
      // auth
      user, authLoading, handleLogin, handleLogout,
      // data
      resumes, resumes_loading, gmailConnected, loadResumes,
      // flow state
      jobResult, setJobResult,
      matchResult, setMatchResult,
      fakeJobResult, setFakeJobResult,
      duplicateWarning, setDuplicateWarning: setDupWarning,
      pipelineSteps, setPipelineSteps, setStep,
      resetFlow,
      // resume actions
      handleResumeUploaded, handleResumeDeleted,
      // toast
      toast, showToast, clearToast,
      // history
      historyRefreshTrigger, triggerHistoryRefresh: () => setHistoryRefreshTrigger(p => p + 1),
      // api const
      API,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
