import React from 'react';

export default function HRContactItem({ contact, onGenerateMessage }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div>
        <h4 className="text-lg font-bold text-white mb-1">{contact.name}</h4>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-slate-400">
          <span className="text-violet-400 font-medium">{contact.title}</span>
          {contact.location && (
            <>
              <span className="hidden sm:inline text-slate-600">•</span>
              <span>📍 {contact.location}</span>
            </>
          )}
        </div>
      </div>
      
      <button 
        onClick={() => onGenerateMessage(contact)}
        className="shrink-0 w-full sm:w-auto px-5 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-semibold text-white transition-colors"
      >
        Generate Message
      </button>
    </div>
  );
}
