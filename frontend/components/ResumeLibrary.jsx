import { useState } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function ResumeLibrary({ resumes, onDeleted }) {
  const [deleting, setDeleting] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const handleDelete = async (filename, originalName) => {
    if (!confirm(`Delete "${originalName}"? This cannot be undone.`)) return;
    setDeleting(filename);
    try {
      await axios.delete(`${API}/resumes/${encodeURIComponent(filename)}`);
      onDeleted?.(filename);
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || 'Failed to delete resume.');
    } finally {
      setDeleting(null);
    }
  };

  const toggleExpand = (filename) => {
    setExpanded(prev => prev === filename ? null : filename);
  };

  const originalResumes = resumes.filter(r => !r.isTailored);
  const tailoredResumes = resumes.filter(r => r.isTailored);

  return (
    <div className="glass-card p-6 slide-up">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon bg-teal-600/20 text-teal-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-base">Resume Library</h2>
          <p className="text-xs text-slate-400">All uploaded and AI-tailored resumes</p>
        </div>
        <span className="badge-blue text-sm px-3 py-1">
          {resumes.length} total
        </span>
      </div>

      {/* Empty state */}
      {resumes.length === 0 && (
        <div className="text-center py-10 fade-in">
          <div className="w-16 h-16 rounded-2xl bg-teal-900/20 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">No resumes uploaded yet</p>
          <p className="text-slate-500 text-xs mt-1">Upload PDF resumes above to get started</p>
        </div>
      )}

      {/* Resume Lists */}
      <div className="space-y-6 mt-4">
        {originalResumes.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Original Resumes</h3>
            <div className="space-y-3">
              {originalResumes.map(resume => (
                <ResumeItem key={resume.filename} resume={resume} expanded={expanded} toggleExpand={toggleExpand} handleDelete={handleDelete} deleting={deleting} />
              ))}
            </div>
          </div>
        )}

        {tailoredResumes.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-3">AI Tailored Resumes</h3>
            <div className="space-y-3">
              {tailoredResumes.map(resume => (
                <ResumeItem key={resume.filename} resume={resume} expanded={expanded} toggleExpand={toggleExpand} handleDelete={handleDelete} deleting={deleting} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeItem({ resume, expanded, toggleExpand, handleDelete, deleting }) {
  const p = resume.parsedData || {};
  const isExpanded = expanded === resume.filename;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all duration-200 fade-in ${
        resume.isTailored
          ? 'border-brand-500/20 bg-brand-900/10'
          : 'border-white/5 bg-navy-900/40 hover:border-white/10'
      }`}
    >
      {/* Resume Card Header */}
      <div className="flex items-center gap-3 p-4">
        {/* PDF Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
          resume.isTailored ? 'bg-brand-900/30 border-brand-500/30' : 'bg-red-900/30 border-red-500/20'
        }`}>
          <span className={`${resume.isTailored ? 'text-brand-400' : 'text-red-400'} text-xs font-bold`}>PDF</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white text-sm truncate">
              {p.name || resume.originalName}
            </p>
            {resume.isTailored ? (
              <span className="badge bg-brand-900/30 text-brand-300 border border-brand-500/20 text-[10px] py-0 px-2">✨ AI Optimized</span>
            ) : p.idealRole ? (
               <span className="badge bg-teal-900/30 text-teal-300 border border-teal-500/20 text-[10px] py-0 px-2">{p.idealRole}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-0.5" >
            {p.email && (
              <span className="text-xs text-slate-400 truncate">{p.email}</span>
            )}
            {p.location && (
              <span className="text-xs text-slate-500">• {p.location}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              const url = `${API}/resumes/download/${encodeURIComponent(resume.filename)}?isTailored=${resume.isTailored || false}`;
              window.open(url, '_blank');
            }}
            className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-emerald-900/20"
            title="Download PDF"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={() => toggleExpand(resume.filename)}
            className="text-slate-400 hover:text-brand-400 transition-colors p-1.5 rounded-lg hover:bg-brand-900/20"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(resume.filename, resume.originalName)}
            disabled={deleting === resume.filename}
            className="btn-danger py-1.5 px-3 text-xs"
          >
            {deleting === resume.filename ? '...' : '🗑 Delete'}
          </button>
        </div>
      </div>

      {/* Skills Preview */}
      {p.skills && p.skills.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-white/5">
          {p.skills.slice(0, isExpanded ? 30 : 6).map((skill, i) => (
            <span key={i} className="skill-tag">{skill}</span>
          ))}
          {!isExpanded && p.skills.length > 6 && (
            <span className="text-xs text-slate-500 py-1">+{p.skills.length - 6} more</span>
          )}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 fade-in">
          {/* Experience */}
          {p.experience?.length > 0 && (
            <div>
              <p className="section-label">Experience</p>
              <div className="space-y-2">
                {p.experience.slice(0, 3).map((exp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{exp.role}</p>
                      <p className="text-xs text-slate-400">{exp.company} · {exp.duration}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {p.education?.length > 0 && (
            <div>
              <p className="section-label">Education</p>
              {p.education.map((edu, i) => (
                <p key={i} className="text-sm text-slate-300">
                  {edu.degree} – <span className="text-slate-400">{edu.institution}</span>
                  {edu.year && <span className="text-slate-500"> ({edu.year})</span>}
                </p>
              ))}
            </div>
          )}

          {/* Tools */}
          {p.tools?.length > 0 && (
            <div>
              <p className="section-label">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {p.tools.map((tool, i) => (
                  <span key={i} className="badge bg-slate-800/60 text-slate-300 border border-white/10">{tool}</span>
                ))}
              </div>
            </div>
          )}

          {/* File info */}
          <div className="text-xs text-slate-500 pt-2 border-t border-white/5">
            <span>File: {resume.originalName}</span>
            <span className="ml-3">Uploaded: {new Date(resume.uploadedAt).toLocaleDateString()}</span>
            {resume.fileSize && (
              <span className="ml-3">{(resume.fileSize / 1024).toFixed(0)} KB</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

