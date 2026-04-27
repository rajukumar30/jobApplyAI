import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function ResumeUploadPanel({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const processFiles = useCallback(async (files) => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      setError('Please select PDF files only.');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(pdfFiles.map(f => ({ name: f.name, status: 'uploading' })));

    const formData = new FormData();
    pdfFiles.forEach(f => formData.append('resumes', f));

    try {
      const res = await axios.post(`${API}/resumes/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          // Progress tracking handled via status messages
        },
      });

      const { uploaded, errors, resumes, errorDetails } = res.data;

      setProgress(pdfFiles.map((f, i) => {
        const errDetail = (errorDetails || []).find(e => e.file === f.name);
        return {
          name: f.name,
          status: errDetail ? 'error' : 'done',
          error: errDetail?.error,
        };
      }));

      if (resumes?.length > 0) {
        onUploaded?.(resumes);
      }

      if (errors > 0 && uploaded === 0) {
        setError(`All uploads failed. Check that your PDFs contain readable text.`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
      setProgress(prev => prev.map(p => ({ ...p, status: 'error' })));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onUploaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onFileChange = (e) => {
    if (e.target.files?.length) processFiles(e.target.files);
  };

  return (
    <div className="glass-card p-6 slide-up">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon bg-violet-600/20 text-violet-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-white text-base">Resume Upload</h2>
          <p className="text-xs text-slate-400">PDF files only — upload once, reuse forever</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        id="resume-drop-zone"
        className={`drop-zone ${dragging ? 'dragging' : ''} ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          id="resume-file-input"
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={onFileChange}
        />

        <div className="flex flex-col items-center gap-3 text-slate-400">
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
              <p className="text-sm text-brand-400 font-medium">Uploading & parsing with AI...</p>
              <p className="text-xs text-slate-500">This may take 10–30 seconds per resume</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-violet-900/30 border border-violet-500/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Drop PDF resumes here</p>
                <p className="text-xs text-slate-500 mt-1">or click to browse — max 10MB per file</p>
              </div>
              <div className="flex gap-2 mt-1">
                <span className="badge-blue">PDF Only</span>
                <span className="badge bg-violet-900/40 text-violet-300 border border-violet-700/30">AI Parsed</span>
                <span className="badge-green">Multiple Files</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {progress.length > 0 && (
        <div className="mt-4 space-y-2 fade-in">
          {progress.map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm p-2.5 rounded-xl bg-navy-900/40">
              {item.status === 'uploading' && (
                <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin flex-shrink-0" />
              )}
              {item.status === 'done' && (
                <span className="w-4 h-4 flex-shrink-0 text-emerald-400">✓</span>
              )}
              {item.status === 'error' && (
                <span className="w-4 h-4 flex-shrink-0 text-red-400">✗</span>
              )}
              <span className={`truncate flex-1 ${item.status === 'error' ? 'text-red-300' : 'text-slate-300'}`}>
                {item.name}
              </span>
              <span className={`text-xs flex-shrink-0 ${
                item.status === 'done' ? 'text-emerald-400' :
                item.status === 'error' ? 'text-red-400' : 'text-brand-400'
              }`}>
                {item.status === 'done' ? 'Parsed ✓' : item.status === 'error' ? 'Failed' : 'Processing...'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm fade-in">
          {error}
        </div>
      )}

      {/* Tip */}
      <p className="mt-4 text-xs text-slate-500 text-center">
        💡 Resumes are parsed once and stored locally. No re-uploads needed.
      </p>
    </div>
  );
}
