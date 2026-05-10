import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PageLayout from '../../components/layout/PageLayout';
import CompanyCard from '../../components/auto-dm/CompanyCard';
import axios from 'axios';
import { useApp } from '../../lib/AppContext';

export default function AutoDMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [error, setError] = useState(null);
  const [extMissing, setExtMissing] = useState(false);
  
  const [syncKey, setSyncKey] = useState(null);
  const [syncKeyLoading, setSyncKeyLoading] = useState(false);
  const [sortMethod, setSortMethod] = useState('connections');
  
  const { user } = useApp();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  // ── Guard: redirect to install page if extension is not detected ──────────
  // Poll every 300ms for up to 3 seconds — content scripts can be slightly slow
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 10; // 10 × 300ms = 3 seconds total

    const interval = setInterval(() => {
      attempts++;
      if (document.getElementById('jobapply-ext-installed')) {
        // Extension confirmed — stop polling, stay on page
        clearInterval(interval);
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        // Extension not found after 3 seconds — redirect to install guide
        clearInterval(interval);
        setExtMissing(true);
        router.replace('/auto-dm/install');
      }
    }, 300);

    return () => clearInterval(interval);
  }, [router]);

  const fetchConnections = async (key) => {
    setLoading(true);
    setError(null);
    try {
      const qs = key ? `?syncKey=${key}` : '';
      const res = await axios.get(`${API}/dm/connections${qs}`, { withCredentials: true });
      if (res.data.success) {
        setCompanies(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load connections.');
    } finally {
      setLoading(false);
    }
  };

  const loadSyncKey = async () => {
    if (!user?.uid) return;
    setSyncKeyLoading(true);
    try {
      const res = await axios.get(`${API}/dm/sync-key?uid=${user.uid}`, { withCredentials: true });
      if (res.data.success && res.data.syncKey) {
        setSyncKey(res.data.syncKey);
        fetchConnections(res.data.syncKey);
      }
    } catch (err) {
      console.error('Error fetching sync key:', err);
      // Fallback
      fetchConnections();
    } finally {
      setSyncKeyLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadSyncKey();
    } else {
      fetchConnections();
    }
  }, [user]);

  const copyToClipboard = () => {
    if (syncKey) {
      navigator.clipboard.writeText(syncKey);
      alert('Sync Key copied to clipboard!');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Limit is 5MB.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const res = await axios.post(`${API}/dm/upload-connections`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });

      if (res.data.success) {
        setUploadMessage(`Connections imported successfully. ${res.data.totalAnalyzed} connections analyzed. ${res.data.companiesFound} companies with HR contacts found.`);
        setCompanies(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
      e.target.value = null; // Clear input
    }
  };

  // Sorting Logic
  const getSortedCompanies = () => {
    let sorted = [...companies];
    if (sortMethod === 'alphabetical') {
      sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
    } else if (sortMethod === 'location') {
      sorted.sort((a, b) => (a.primaryLocation || '').localeCompare(b.primaryLocation || ''));
    } else {
      // Default: connections descending
      sorted.sort((a, b) => b.hrConnectionsCount - a.hrConnectionsCount);
    }
    return sorted;
  };

  const displayedCompanies = getSortedCompanies();
  const limitedCompanies = displayedCompanies.slice(0, 50);

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Auto Send DM to HR</h1>
            <p className="text-slate-400 text-sm mb-4">
              Upload your LinkedIn Connections to automatically detect recruiters and generate highly personalized outreach DMs.
            </p>
            {user && (
              <div className="flex items-center space-x-3 bg-slate-800/80 border border-slate-700 w-max px-4 py-2 rounded-lg">
                <span className="text-xs text-slate-400">Extension Sync Key:</span>
                {syncKeyLoading ? (
                  <span className="text-sm font-semibold text-slate-500">Loading...</span>
                ) : (
                  <code className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-brand-400 font-mono text-sm">
                    {syncKey || 'Not Available'}
                  </code>
                )}
                {syncKey && (
                  <button 
                    onClick={copyToClipboard}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-200 transition-colors"
                  >
                    Copy
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 w-full md:w-auto mt-4 md:mt-0">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Upload LinkedIn Connections CSV
            </label>
            <input 
              type="file" 
              accept=".csv"
              id="csvUpload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label 
              htmlFor="csvUpload" 
              className={`block w-full text-center px-4 py-2 border rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                uploading ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-brand-600 border-brand-500 hover:bg-brand-500 text-white'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </label>
          </div>
        </div>

        {uploadMessage && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg text-sm">
            {uploadMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Analyzing your LinkedIn connections...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
            <span className="text-4xl mb-4 block">📭</span>
            <h3 className="text-xl font-bold text-white mb-2">No HR Contacts Found</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              No HR contacts were detected in your connections. Try uploading a different LinkedIn Connections export.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-end mb-6">
              <div className="text-sm text-slate-400">
                Found contacts at <span className="text-white font-semibold">{companies.length}</span> companies
              </div>
              <div>
                <span className="text-xs text-slate-500 mr-2 uppercase">Sort By:</span>
                <select 
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500"
                  value={sortMethod}
                  onChange={(e) => setSortMethod(e.target.value)}
                >
                  <option value="connections">Most HR Connections</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="location">Location</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {limitedCompanies.map((company, idx) => (
                <CompanyCard 
                  key={idx}
                  companyName={company.companyName}
                  hrConnectionsCount={company.hrConnectionsCount}
                  topRole={company.topRole}
                  primaryLocation={company.primaryLocation}
                />
              ))}
            </div>

            {displayedCompanies.length > 50 && (
              <div className="mt-8 text-center text-sm text-slate-500 bg-slate-800/30 py-3 rounded-lg border border-slate-700/30">
                Showing top 50 companies with HR connections.
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
