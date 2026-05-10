import React from 'react';
import { useRouter } from 'next/router';

export default function CompanyCard({ companyName, hrConnectionsCount, topRole, primaryLocation }) {
  const router = useRouter();

  const handleViewContacts = () => {
    router.push(`/auto-dm/company/${encodeURIComponent(companyName)}`);
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 hover:border-violet-500/30 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{companyName}</h3>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>👥 {hrConnectionsCount} HR connections</span>
            {primaryLocation && (
              <>
                <span>•</span>
                <span>📍 {primaryLocation}</span>
              </>
            )}
          </div>
        </div>
        <div className="bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full text-xs font-semibold">
          {topRole || 'HR'}
        </div>
      </div>
      
      <button 
        onClick={handleViewContacts}
        className="w-full mt-2 py-2 bg-slate-700/50 hover:bg-violet-600 border border-slate-600 hover:border-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
      >
        View HR Contacts
      </button>
    </div>
  );
}
