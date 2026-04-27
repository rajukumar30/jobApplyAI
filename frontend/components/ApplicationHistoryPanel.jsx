import { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function ApplicationHistoryPanel({ refreshTrigger }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/applications`);
      setApplications(res.data.applications || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setError('Could not load application history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this application record?')) return;
    setDeletingId(id);
    try {
      await axios.delete(`${API}/applications/${id}`);
      setApplications(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert('Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && applications.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="font-semibold text-white mb-4">Application History</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 slide-up h-full flex flex-col">
      <div className="panel-header mb-4">
        <div className="panel-icon bg-indigo-600/20 text-indigo-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-base">History ({applications.length})</h2>
          <p className="text-xs text-slate-400">Past job applications tracked in Firebase</p>
        </div>
        <button 
          onClick={fetchHistory}
          className="p-1.5 text-slate-400 hover:text-white transition-colors"
          title="Refresh History"
        >
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 max-h-[500px]">
        {applications.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm">No history yet.</p>
          </div>
        ) : (
          applications.map((app) => (
            <div 
              key={app.id} 
              className="bg-navy-900/40 border border-white/5 rounded-xl p-3 hover:border-indigo-500/30 transition-all group"
            >
              <div className="flex justify-between items-start mb-1">
                <p className="font-semibold text-white text-sm truncate pr-2">{app.company}</p>
                <span className="text-[10px] bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
                  {app.date}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-2 truncate">{app.role}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                  {app.resume || 'No resume recorded'}
                </span>
                <button
                  onClick={() => handleDelete(app.id)}
                  disabled={deletingId === app.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-red-400"
                  title="Delete record"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
