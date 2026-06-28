import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function FormatAtsBadge({ originalScore, tailoredScore }) {
  if (tailoredScore == null) return null;
  const improved = originalScore != null && tailoredScore > originalScore;
  const color = tailoredScore >= 80 ? 'text-emerald-400' : tailoredScore >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">ATS match</p>
      {originalScore != null ? (
        <p className={`text-xs font-bold ${color}`}>
          {originalScore}% → {tailoredScore}%
          {improved && <span className="text-emerald-500 font-normal ml-1">↑</span>}
        </p>
      ) : (
        <p className={`text-xs font-bold ${color}`}>{tailoredScore}%</p>
      )}
    </div>
  );
}

export default function ResumeFormatPicker({
  originalData,
  rewrittenSections,
  jobData,
  jobTitle,
  collegeTierInfo,
  originalMatchPercentage,
  tailoredMatchPercentage,
  showToast,
}) {
  const [formats, setFormats] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    axios.get(`${API}/job/resume-formats`)
      .then((res) => setFormats(res.data.formats || []))
      .catch(() => showToast?.('error', 'Could not load resume formats.'));
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadPreview = useCallback(async (formatId) => {
    if (!originalData || !rewrittenSections) return;

    setPreviewLoading(true);
    setSelectedId(formatId);
    setDownloaded(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const res = await axios.post(
        `${API}/job/preview-resume-format`,
        {
          formatId,
          originalData,
          rewrittenSections,
          jobData,
          collegeTierInfo,
          tailoredMatchPercentage,
        },
        { responseType: 'blob', timeout: 120000 }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPreviewUrl(url);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Preview failed.';
      showToast?.('error', typeof msg === 'string' ? msg : 'Preview failed.');
      setSelectedId(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [originalData, rewrittenSections, jobData, collegeTierInfo, tailoredMatchPercentage, showToast]);

  const handleDownload = () => {
    if (!previewUrl || !selectedId) return;
    const safeTitle = (jobTitle || jobData?.jobTitle || 'resume')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .slice(0, 40);
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `tailored_${safeTitle}_${selectedId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloaded(true);
    showToast?.('success', 'Download started. Save the file — it is not stored in the cloud.');
  };

  const selectedFormat = formats.find((f) => f.id === selectedId);

  return (
    <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8 border border-brand-500/20 slide-up">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white mb-1">Choose a resume format</h3>
        <p className="text-sm text-slate-400">
          Preview your tailored content in each layout. ATS score is the same for every format — only the design changes.
        </p>
        {tailoredMatchPercentage != null && (
          <p className="text-sm text-brand-300 mt-2">
            Tailored ATS match:{' '}
            {originalMatchPercentage != null && (
              <span className="text-slate-400">{originalMatchPercentage}% → </span>
            )}
            <span className="font-bold">{tailoredMatchPercentage}%</span>
            {originalMatchPercentage != null && tailoredMatchPercentage > originalMatchPercentage && (
              <span className="text-emerald-400 text-xs ml-1">improved</span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {formats.map((fmt) => {
          const isSelected = selectedId === fmt.id;
          const isLoading = isSelected && previewLoading;
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => loadPreview(fmt.id)}
              disabled={previewLoading && !isSelected}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'border-brand-400 bg-brand-900/20 ring-1 ring-brand-500/40'
                  : 'border-white/10 bg-navy-900/30 hover:border-white/20'
              }`}
            >
              <p className="text-sm font-semibold text-white mb-1">{fmt.name}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{fmt.description}</p>
              {fmt.supportsKeywordBold && (
                <span className="inline-block mt-2 text-[10px] badge-green">JD keywords bolded</span>
              )}
              <FormatAtsBadge
                originalScore={originalMatchPercentage}
                tailoredScore={tailoredMatchPercentage}
              />
              {isLoading && (
                <p className="text-xs text-brand-300 mt-2">Compiling preview…</p>
              )}
            </button>
          );
        })}
      </div>

      {previewUrl && (
        <>
          <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-900/10">
            <p className="text-sm text-amber-200 font-medium mb-1">Download before you leave this page</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Your tailored PDF is kept only in this browser tab while you preview it. It is{' '}
              <strong>not saved</strong> to your resume library. Download it now or it will be lost when you close or
              leave this page.
            </p>
          </div>

          <div className="mb-5">
            <p className="text-xs text-slate-500 mb-2">
              Live preview — {selectedFormat?.name || selectedId}
              {tailoredMatchPercentage != null && (
                <span className="text-brand-400 ml-2">· ATS {tailoredMatchPercentage}%</span>
              )}
            </p>
            <iframe
              title="Resume format preview"
              src={previewUrl}
              className="w-full h-[min(360px,50vh)] sm:h-[min(520px,65vh)] rounded-lg border border-white/10 bg-white"
            />
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!selectedId || !previewUrl || previewLoading}
          className="btn-primary px-8 py-3 disabled:opacity-50"
        >
          {downloaded ? 'Download again' : 'Download PDF'}
        </button>
        {downloaded && (
          <p className="text-xs text-emerald-400">Saved to your device — not stored in the cloud.</p>
        )}
      </div>
    </div>
  );
}
