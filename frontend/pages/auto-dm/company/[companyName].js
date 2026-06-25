import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PageLayout from '../../../components/layout/PageLayout';
import HRContactList from '../../../components/auto-dm/HRContactList';
import GenerateMessageModal from '../../../components/auto-dm/GenerateMessageModal';
import MessagePreviewModal from '../../../components/auto-dm/MessagePreviewModal';
import axios from 'axios';
import { useApp } from '../../../lib/AppContext';

export default function CompanyHRPage() {
  const router = useRouter();
  const { companyName } = router.query;
  const { user, authLoading } = useApp();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  // Require authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [companyData, setCompanyData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Modals state
  const [selectedContact, setSelectedContact] = useState(null);
  const [generatedMessage, setGeneratedMessage] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    if (!companyName) return;

    const fetchCompanyData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/dm/connections`);
        if (res.data.success) {
          const allCompanies = res.data.data;
          const target = allCompanies.find(c => c.companyName === companyName);
          if (target) {
            setCompanyData(target);
          } else {
            setError(`No HR data found for ${companyName}.`);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load company HR data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [companyName]);

  const handleGenerateClick = (contact) => {
    setSelectedContact(contact);
    setShowGenerateModal(true);
  };

  const handleGenerateMessage = async ({ targetRole, candidateSkills, appliedJobTitle }) => {
    const payload = {
      hrName: selectedContact.name,
      companyName: selectedContact.companyName,
      candidateName: user?.displayName || 'Candidate',
      targetRole,
      candidateSkills,
      appliedJobTitle
    };

    const res = await axios.post(`${API}/dm/generate-message`, payload);
    
    if (res.data.success) {
      setGeneratedMessage(res.data.message);
      setShowGenerateModal(false);
      setShowPreviewModal(true);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading HR contacts...</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !companyData) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto py-10">
          <button onClick={() => router.push('/auto-dm')} className="text-brand-400 hover:text-brand-300 mb-6 flex items-center gap-2 text-sm font-medium">
            ← Back to Companies
          </button>
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl">
            {error || 'Company not found.'}
          </div>
        </div>
      </PageLayout>
    );
  }

  // Pagination Logic
  const totalContacts = companyData.contacts.length;
  const totalPages = Math.ceil(totalContacts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentContacts = companyData.contacts.slice(startIndex, endIndex);

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto py-6">
        <button onClick={() => router.push('/auto-dm')} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 text-sm font-medium transition-colors">
          ← Back to Companies
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-slate-700/50">
          <div>
            <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Company Details</div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{companyData.companyName}</h1>
            <div className="text-slate-400 mt-2 text-sm">
              <span className="font-medium text-slate-300">{totalContacts}</span> HR Contacts found
            </div>
          </div>
          
          <button 
            onClick={() => handleGenerateClick(companyData.contacts[0])}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg shadow-lg shadow-brand-500/20 transition-all active:scale-95"
          >
            Generate Message (Top HR)
          </button>
        </div>

        <HRContactList 
          contacts={currentContacts} 
          onGenerateMessage={handleGenerateClick} 
        />

        {totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <span className="text-sm text-slate-400 mb-4 sm:mb-0">
              Showing {startIndex + 1}–{Math.min(endIndex, totalContacts)} of {totalContacts} HR contacts
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-slate-300 transition-colors"
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-slate-300 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showGenerateModal && selectedContact && (
        <GenerateMessageModal 
          contact={selectedContact}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerateMessage}
        />
      )}

      {showPreviewModal && generatedMessage && selectedContact && (
        <MessagePreviewModal
          message={generatedMessage}
          profileUrl={selectedContact.profileUrl}
          onClose={() => {
            setShowPreviewModal(false);
            setGeneratedMessage(null);
          }}
        />
      )}
    </PageLayout>
  );
}
