import React, { useState } from 'react';

export default function MessagePreviewModal({ message, profileUrl, onClose }) {
  const [editedMessage, setEditedMessage] = useState(message);
  const [copied, setCopied] = useState(false);

  const handleCopyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (profileUrl) {
        window.open(profileUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Message Preview</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-4 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
            <span>⚠️</span>
            <span>Review and edit your message before sending it on LinkedIn.</span>
          </div>

          <textarea
            className="w-full h-64 bg-slate-900/50 border border-slate-700 text-white rounded-xl p-5 focus:outline-none focus:border-brand-500 resize-none leading-relaxed"
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
          />
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/80 flex flex-col sm:flex-row justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleCopyAndOpen}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
              copied ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#0a66c2] hover:bg-[#004182]'
            }`}
          >
            {copied ? (
              <>
                <span>✅</span> Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>
                Copy & Open Profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
