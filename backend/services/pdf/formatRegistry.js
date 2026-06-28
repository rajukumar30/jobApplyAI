const path = require('path');

const FORMATS_DIR = path.join(__dirname, '../../templates/formats');

const RESUME_FORMATS = [
  {
    id: 'ats-classic',
    name: 'ATS Classic',
    description: 'Your ATS layout — Times font, tight margins, keyword bolding for JD match.',
    supportsKeywordBold: true,
    templateFile: 'ats-classic.tex',
    source: 'main (5).tex',
  },
  {
    id: 'harshibar',
    name: 'Harshibar Modern',
    description: 'Sans-serif single column — experience first, education placement by college tier.',
    supportsKeywordBold: false,
    templateFile: 'harshibar.tex',
    source: 'main (3).tex',
  },
  {
    id: 'iiit-boxed',
    name: 'IIIT Boxed',
    description: 'Boxed section headers — includes Class 10/12 only when present in your resume.',
    supportsKeywordBold: false,
    templateFile: 'iiit-boxed.tex',
    source: 'main (4).tex',
  },
  {
    id: 'professional-cv',
    name: 'Professional CV',
    description: 'Trey Hunner medium-length CV — clean rSection layout, no declaration.',
    supportsKeywordBold: false,
    templateFile: 'resume.cls',
    source: 'cv_4.tex',
  },
];

function getFormatById(formatId) {
  return RESUME_FORMATS.find((f) => f.id === formatId) || RESUME_FORMATS[0];
}

function getTemplatePath(formatId) {
  const format = getFormatById(formatId);
  return path.join(FORMATS_DIR, format.templateFile);
}

function listResumeFormats() {
  return RESUME_FORMATS.map(({ id, name, description, supportsKeywordBold, source }) => ({
    id,
    name,
    description,
    supportsKeywordBold,
    source,
  }));
}

module.exports = {
  RESUME_FORMATS,
  FORMATS_DIR,
  getFormatById,
  getTemplatePath,
  listResumeFormats,
};
