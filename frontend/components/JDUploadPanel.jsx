import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const ACCEPTED_TYPES = '.pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif';

export default function JDUploadPanel({ onTailorRequest, disabled = false }) {
  const [tab, setTab] = useState('text'); // 'text' | 'file'
  const [jobText, setJobText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'txt', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowed.includes(ext)) {
      setError('Unsupported file type. Use PDF, TXT, DOC, DOCX, or an image.');
      return;
    }
    setError('');
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const handleSubmit = async () => {
    setError('');

    if (tab === 'text') {
      const text = jobText.trim();
      if (text.length < 50) {
        setError('Job description is too short. Paste at least 50 characters.');
        return;
      }
      onTailorRequest?.({ text });
      return;
    }

    if (!selectedFile) {
      setError('Please upload a job description file.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('jd', selectedFile);
      const res = await axios.post(`${API}/job/parse-jd`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = res.data?.text?.trim();
      if (!text || text.length < 50) {
        setError('Could not extract enough text from the file. Try another file or paste manually.');
        return;
      }
      onTailorRequest?.({ text, sourceFile: selectedFile.name });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse job description file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="panel-header mb-4">
        <div className="panel-icon bg-violet-600/20 text-violet-400">
          <span className="text-lg">📄</span>
        </div>
        <div>
          <h2 className="font-semibold text-white text-base">Job Description</h2>
          <p className="text-xs text-slate-400">Paste text or upload PDF, Word, image, or TXT</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy-900/60 rounded-xl mb-4">
        {[
          { id: 'text', label: 'Paste Text' },
          { id: 'file', label: 'Upload File' },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-violet-600/30 text-violet-200 border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'text' ? (
        <div className="space-y-3 flex-1 flex flex-col">
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job description here — role, requirements, skills, responsibilities..."
            className="form-textarea flex-1 min-h-[220px]"
            disabled={disabled || loading}
          />
          <p className="text-xs text-slate-500 text-right">{jobText.length} characters</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 min-h-[220px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragging
              ? 'border-violet-400 bg-violet-900/20'
              : selectedFile
                ? 'border-violet-500/40 bg-violet-900/10'
                : 'border-white/10 hover:border-violet-500/30 hover:bg-navy-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {selectedFile ? (
            <>
              <span className="text-3xl mb-2">📎</span>
              <p className="text-sm font-medium text-white">{selectedFile.name}</p>
              <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024).toFixed(0)} KB · Click to change</p>
            </>
          ) : (
            <>
              <span className="text-3xl mb-2">⬆️</span>
              <p className="text-sm text-slate-300 font-medium">Drop JD file here or click to browse</p>
              <p className="text-xs text-slate-500 mt-2 text-center px-4">
                PDF · DOC · DOCX · TXT · JPG · PNG · WebP
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-3">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || loading}
        className="btn-primary w-full mt-4 py-3"
      >
        {loading ? 'Parsing file…' : '✨ Tailor My Resume'}
      </button>
    </div>
  );
}
