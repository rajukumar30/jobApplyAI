import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../../lib/AppContext';

export default function GenerateMessageModal({ contact, onClose, onGenerate }) {
  const { resumes, API } = useApp();
  
  // Custom states for dynamic dropdown toggling
  const [roleOptions, setRoleOptions] = useState([]);
  const [skillsMap, setSkillsMap] = useState({});
  const [historyOptions, setHistoryOptions] = useState([]);
  const [isOtherRole, setIsOtherRole] = useState(false);
  const [isOtherTitle, setIsOtherTitle] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [candidateSkills, setCandidateSkills] = useState('');
  const [appliedJobTitle, setAppliedJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. Scan Resumes for Target Roles and Top Skills
    const roles = [];
    const skillsMapping = {};

    if (resumes && resumes.length > 0) {
      resumes.forEach(r => {
        const pd = r.parsedData;
        if (!pd) return;

        let roleName = pd.idealRole;
        if (!roleName && pd.experience && pd.experience.length > 0) {
          roleName = pd.experience[0].role;
        }

        if (roleName) {
          // Truncate overly long idealRoles
          if (roleName.length > 60) roleName = roleName.substring(0, 60) + '...';
          
          if (!roles.includes(roleName)) roles.push(roleName);

          // Build a broader skill string per role
          let skillStr = '';
          if (pd.skills && pd.skills.length > 0) {
            // Take up to 25 skills to ensure technologies like SQL, Python, PowerBI are included
            skillStr = pd.skills.slice(0, 25).join(', ');
          }
          skillsMapping[roleName] = skillStr;
        }
      });
    }

    setRoleOptions(roles);
    setSkillsMap(skillsMapping);

    // Auto-select first item
    if (roles.length > 0 && !targetRole) {
      setTargetRole(roles[0]);
      setCandidateSkills(skillsMapping[roles[0]] || '');
    } else if (roles.length === 0) {
      setIsOtherRole(true);
    }

    // 2. Scan History for previously applied Job Titles at THIS Company
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/applications`, { withCredentials: true });
        if (res.data.success) {
          const apps = res.data.applications || [];
          const matchedApps = apps.filter(a => a.companyName?.toLowerCase() === contact.companyName?.toLowerCase());
          const uniqueTitles = [...new Set(matchedApps.map(a => a.jobTitle))].filter(Boolean);
          
          setHistoryOptions(uniqueTitles);

          if (uniqueTitles.length > 0 && !appliedJobTitle) {
            setAppliedJobTitle(uniqueTitles[0]);
          } else if (uniqueTitles.length === 0) {
            setIsOtherTitle(true);
          }
        }
      } catch (err) {
        setIsOtherTitle(true);
        console.error('Failed to fetch history:', err);
      }
    };
    
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleChange = (e) => {
    const val = e.target.value;
    if (val === 'other') {
      setIsOtherRole(true);
      setTargetRole('');
      setCandidateSkills('');
    } else {
      setIsOtherRole(false);
      setTargetRole(val);
      setCandidateSkills(skillsMap[val] || '');
    }
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    if (val === 'other') {
      setIsOtherTitle(true);
      setAppliedJobTitle('');
    } else {
      setIsOtherTitle(false);
      setAppliedJobTitle(val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetRole.trim()) {
      setError('Target role is required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onGenerate({ targetRole, candidateSkills, appliedJobTitle });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Failed to generate message.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Generate Outreach Message</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 bg-brand-500/10 border border-brand-500/20 p-4 rounded-xl">
            <p className="text-sm text-slate-300">
              Generating message for <span className="text-white font-semibold">{contact.name}</span> <span className="text-slate-500">({contact.title})</span> at <span className="text-white font-semibold">{contact.companyName}</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form id="gen-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Target Role / Field <span className="text-red-400">*</span>
              </label>
              
              {!isOtherRole && roleOptions.length > 0 ? (
                <select
                  className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                  value={targetRole || ''}
                  onChange={handleRoleChange}
                  required
                >
                  {roleOptions.map((r, i) => <option key={i} value={r}>{r}</option>)}
                  <option value="other">Other (Type custom role...)</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Data Analytics, Frontend Developer"
                  className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Applied Job Title <span className="text-slate-500 font-normal">(Optional)</span>
              </label>

              {!isOtherTitle && historyOptions.length > 0 ? (
                <select
                  className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                  value={appliedJobTitle || ''}
                  onChange={handleTitleChange}
                >
                  {historyOptions.map((t, i) => <option key={i} value={t}>{t}</option>)}
                  <option value="other">Other (Type custom title...)</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Sr. Systems Engineer"
                  className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                  value={appliedJobTitle}
                  onChange={(e) => setAppliedJobTitle(e.target.value)}
                />
              )}
              <p className="text-xs text-slate-500 mt-1">If you recently applied for a specific role here.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Key Skills <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. React, Node.js, Python"
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                value={candidateSkills}
                onChange={(e) => setCandidateSkills(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/80 flex justify-end gap-3">
          <button 
            onClick={onClose}
            type="button"
            className="px-5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="gen-form"
            disabled={loading}
            className={`px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 ${
              loading ? 'bg-brand-600/50 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-500'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                Generating...
              </>
            ) : 'Generate Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
