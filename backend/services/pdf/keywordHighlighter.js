const { escapeLatex } = require('./latexEscape');

/**
 * Wrap JD keywords in \textbf{} for ATS-classic format.
 * Longest-first matching, case-insensitive, whole-token friendly.
 */
function highlightKeywordsInText(text, keywords) {
  if (!text) return '';
  const raw = String(text);
  if (!keywords?.length) return escapeLatex(raw);

  const unique = [...new Set(
    keywords
      .map((k) => String(k).trim())
      .filter((k) => k.length > 1)
  )].sort((a, b) => b.length - a.length);

  if (unique.length === 0) return escapeLatex(raw);

  const pattern = unique
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const re = new RegExp(`(${pattern})`, 'gi');
  const parts = raw.split(re);

  return parts
    .map((part) => {
      if (!part) return '';
      const isMatch = unique.some((k) => k.toLowerCase() === part.toLowerCase());
      return isMatch ? `\\textbf{${escapeLatex(part)}}` : escapeLatex(part);
    })
    .join('');
}

function collectJdKeywords(jobData) {
  if (!jobData) return [];
  const buckets = [
    jobData.requiredSkills,
    jobData.preferredSkills,
    jobData.toolsAndTechnologies,
    jobData.toolsAndTech,
    jobData.industryKeywords,
  ];
  const flat = buckets.flat().filter(Boolean).map((k) => String(k).trim());
  return [...new Set(flat)].filter((k) => k.length > 1);
}

module.exports = { highlightKeywordsInText, collectJdKeywords };
