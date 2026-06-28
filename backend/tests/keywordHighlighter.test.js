const test = require('node:test');
const assert = require('node:assert/strict');
const { highlightKeywordsInText, collectJdKeywords } = require('../services/pdf/keywordHighlighter');
const { fillLatexTemplate, isPdflatexAvailable, compileLatexToPdf, getEngineForFormat } = require('../services/pdf/latexService');
const { listResumeFormats } = require('../services/pdf/formatRegistry');

test('highlightKeywordsInText bolds longest matches first', () => {
  const out = highlightKeywordsInText(
    'Built Java and Spring Boot APIs with REST.',
    ['Spring Boot', 'Java', 'REST']
  );
  assert.match(out, /\\textbf\{Spring Boot\}/);
  assert.match(out, /\\textbf\{Java\}/);
  assert.match(out, /\\textbf\{REST\}/);
});

test('highlightKeywordsInText is case-insensitive', () => {
  const out = highlightKeywordsInText('Expert in python and PYTHON tooling.', ['Python']);
  assert.equal((out.match(/\\textbf\{python\}/gi) || []).length, 2);
});

test('highlightKeywordsInText escapes LaTeX specials in non-keyword text', () => {
  const out = highlightKeywordsInText('100% uptime with Java.', ['Java']);
  assert.match(out, /100\\%/);
  assert.match(out, /\\textbf\{Java\}/);
});

test('highlightKeywordsInText returns escaped text when no keywords', () => {
  const out = highlightKeywordsInText('C# & .NET', []);
  assert.ok(out.includes('C\\#'));
  assert.ok(out.includes('\\&'));
});

test('collectJdKeywords merges job skill buckets', () => {
  const keywords = collectJdKeywords({
    requiredSkills: ['Java'],
    preferredSkills: ['AWS'],
    toolsAndTechnologies: ['Docker'],
    industryKeywords: ['FinTech'],
  });
  assert.deepEqual(keywords.sort(), ['AWS', 'Docker', 'FinTech', 'Java']);
});

test('buildAtsHeader places contact on a separate line from name', () => {
  const { buildResumeTex } = require('../services/pdf/formatBuilders');
  const tex = buildResumeTex(
    { name: 'Raju Kumar', email: 'test@example.com', phone: '6909502635' },
    {},
    { formatId: 'ats-classic' }
  );
  assert.match(tex, /\\Huge\\bfseries Raju Kumar\} \\\\/);
  assert.match(tex, /test@example\.com/);
});

test('fillLatexTemplate uses each template font setup', () => {
  const data = { name: 'Alex Morgan', email: 'alex@example.com' };
  const sections = { summary: 'Summary.', skillCategories: { Stack: ['Java'] }, experienceBullets: [], projects: [] };

  const ats = fillLatexTemplate(data, sections, { formatId: 'ats-classic' });
  assert.match(ats, /\\usepackage\{times\}/);
  assert.match(ats, /\\usepackage\{lmodern\}/);

  const harshibar = fillLatexTemplate(data, sections, { formatId: 'harshibar' });
  assert.match(harshibar, /\\usepackage\{tgheros\}/);
  assert.match(harshibar, /\\renewcommand\*\\familydefault\{\\sfdefault\}/);
  assert.match(harshibar, /\\color\{text-grey\}/);

  const iiit = fillLatexTemplate(data, sections, { formatId: 'iiit-boxed' });
  assert.match(iiit, /\\usepackage\{cfr-lm\}/);
  assert.match(iiit, /\\fontfamily\{cmr\}\\selectfont/);
});

test('fillLatexTemplate renders all four format ids', () => {
  const data = {
    name: 'Alex Morgan',
    email: 'alex@example.com',
    experience: [{ role: 'Engineer', company: 'Acme', startDate: '2022', endDate: 'Present' }],
    education: [{ degree: 'BSc CS', institution: 'State U', graduationYear: '2021' }],
    projects: [],
  };
  const sections = {
    summary: 'Java developer with Spring Boot experience.',
    skillCategories: { Languages: ['Java'] },
    experienceBullets: ['Delivered REST APIs.'],
    projects: [],
  };

  for (const fmt of listResumeFormats()) {
    const tex = fillLatexTemplate(data, sections, { formatId: fmt.id, highlightKeywords: ['Java'] });
    assert.match(tex, /Alex Morgan|Alex/);
    assert.match(tex, /\\begin\{document\}/);
    if (fmt.id === 'ats-classic') {
      assert.match(tex, /\\textbf\{Java\}/);
    }
  }
});

test('pdflatex compiles each resume format when available', { skip: !isPdflatexAvailable(), timeout: 300000 }, async () => {
  const { compileLatexToPdf } = require('../services/pdf/latexService');
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  const data = {
    name: 'Test User',
    email: 'test@example.com',
    experience: [{ role: 'Dev', company: 'Co', startDate: '2020', endDate: '2024' }],
    education: [{ degree: 'BS', institution: 'Uni', graduationYear: '2020' }],
  };
  const sections = {
    summary: 'Summary text.',
    skillCategories: { Stack: ['Node.js'] },
    experienceBullets: ['Did things.'],
    projects: [],
  };

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-format-test-'));

  for (const fmt of listResumeFormats()) {
    const tex = fillLatexTemplate(data, sections, { formatId: fmt.id });
    const base = `smoke_${fmt.id}`;
    if (fmt.id === 'professional-cv') {
      const clsSrc = path.join(__dirname, '../templates/formats/resume.cls');
      fs.copyFileSync(clsSrc, path.join(outputDir, 'resume.cls'));
    }
    const engine = getEngineForFormat(fmt.id);
    const pdf = await compileLatexToPdf(tex, base, outputDir, engine);
    assert.ok(pdf.length > 500, `PDF too small for ${fmt.id}`);
  }
});
