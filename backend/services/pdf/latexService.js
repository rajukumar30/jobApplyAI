const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { compileJsonToPdf } = require('./pdfService');
const { buildResumeDocument } = require('./resumeTemplate');

const TEMPLATE_PATH = path.join(__dirname, '../../templates/resume.tex');
const GENERATED_DIR = path.join(__dirname, '../../generated-resumes');

// ── LaTeX special character escaping ─────────────────────────────────────────
function escapeLatex(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// ── Format skills as LaTeX tabular rows ──────────────────────────────────────
// AI provides skillCategories: { "Category Name": ["skill1", "skill2", ...] }
// Falls back to grouping a flat array into generic categories.
function formatSkillsTabular(skillCategoriesOrArray) {
  if (!skillCategoriesOrArray) return '';

  let categories;

  if (Array.isArray(skillCategoriesOrArray)) {
    // Flat array fallback — split into 3 generic groups
    const total = skillCategoriesOrArray.length;
    const colSize = Math.ceil(total / 3);
    categories = {
      'Core Skills':    skillCategoriesOrArray.slice(0, colSize),
      'Technical Tools': skillCategoriesOrArray.slice(colSize, colSize * 2),
      'Other Skills':   skillCategoriesOrArray.slice(colSize * 2),
    };
  } else {
    categories = skillCategoriesOrArray;
  }

  return Object.entries(categories)
    .filter(([, skills]) => Array.isArray(skills) && skills.length > 0)
    .map(([cat, skills]) =>
      `\\textbf{${escapeLatex(cat)}} & ${skills.map(escapeLatex).join(', ')} \\\\`
    )
    .join('\n');
}

// ── Fill LaTeX template with data ────────────────────────────────────────────
// LOCKED sections are hardcoded in the .tex file (name, contact, edu, certs).
// This function ONLY replaces the content placeholders for the 4 editable areas:
//   {{SUMMARY}}, {{SKILLS}}, {{EXPERIENCE_POINT_N}}, {{PROJECT_N_*}}
//
// rewrittenSections structure (from geminiService.tailorResume):
// {
//   summary: "3-4 sentence text",
//   skillCategories: { "Category": ["skill1", ...], ... },
//   experienceBullets: ["bullet1", ..., "bullet6"],   // 5-6 items
//   projects: [
//     { name: "...", url: "https://...", bullets: ["b1","b2","b3","b4"] },
//     { name: "...", url: "https://...", bullets: ["b1","b2","b3","b4"] }
//   ]
// }
function fillLatexTemplate(originalData, rewrittenSections) {
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const orig = originalData || {};
  const ai   = rewrittenSections || {};

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  template = template.replace(
    /\{\{SUMMARY\}\}/g,
    escapeLatex(ai.summary || orig.summary || '')
  );

  // ── SKILLS (tabular rows) ────────────────────────────────────────────────
  template = template.replace(
    /\{\{SKILLS\}\}/g,
    formatSkillsTabular(ai.skillCategories || orig.skills)
  );

  // ── EXPERIENCE BULLETS (6 individual placeholders) ───────────────────────
  const expBullets = ai.experienceBullets || [];
  for (let i = 1; i <= 6; i++) {
    const bullet = expBullets[i - 1];
    const placeholder = `{{EXPERIENCE_POINT_${i}}}`;
    template = template.replace(
      new RegExp(escapeRegex(placeholder), 'g'),
      bullet ? `\\item ${escapeLatex(bullet)}` : ''
    );
  }

  // ── PROJECT 1 ────────────────────────────────────────────────────────────
  const proj1Orig = orig.projects?.[0] || {};
  const proj1AI   = ai.projects?.[0]   || {};
  const proj1Name = proj1AI.name || proj1Orig.name || 'Project 1';
  const proj1Url  = proj1AI.url  || proj1Orig.url  || proj1Orig.link || '';
  const proj1UrlText = proj1Url.replace(/^https?:\/\//, '');

  template = template.replace(/\{\{PROJECT_1_TITLE\}\}/g,     escapeLatex(proj1Name));
  template = template.replace(/\{\{PROJECT_1_LINK\}\}/g,      proj1Url);           // NOT escaped — raw URL for \href
  template = template.replace(/\{\{PROJECT_1_LINK_TEXT\}\}/g, escapeLatex(proj1UrlText));

  const proj1Bullets = proj1AI.bullets || [];
  for (let i = 1; i <= 4; i++) {
    const bullet = proj1Bullets[i - 1];
    template = template.replace(
      new RegExp(escapeRegex(`{{PROJECT_1_POINT_${i}}}`), 'g'),
      bullet ? `\\item ${escapeLatex(bullet)}` : ''
    );
  }

  // ── PROJECT 2 ────────────────────────────────────────────────────────────
  const proj2Orig = orig.projects?.[1] || {};
  const proj2AI   = ai.projects?.[1]   || {};
  const proj2Name = proj2AI.name || proj2Orig.name || 'Project 2';
  const proj2Url  = proj2AI.url  || proj2Orig.url  || proj2Orig.link || '';
  const proj2UrlText = proj2Url.replace(/^https?:\/\//, '');

  template = template.replace(/\{\{PROJECT_2_TITLE\}\}/g,     escapeLatex(proj2Name));
  template = template.replace(/\{\{PROJECT_2_LINK\}\}/g,      proj2Url);           // NOT escaped — raw URL for \href
  template = template.replace(/\{\{PROJECT_2_LINK_TEXT\}\}/g, escapeLatex(proj2UrlText));

  const proj2Bullets = proj2AI.bullets || [];
  for (let i = 1; i <= 4; i++) {
    const bullet = proj2Bullets[i - 1];
    template = template.replace(
      new RegExp(escapeRegex(`{{PROJECT_2_POINT_${i}}}`), 'g'),
      bullet ? `\\item ${escapeLatex(bullet)}` : ''
    );
  }

  return template;
}

// Helper: escape a literal string for use in RegExp
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Full path to pdflatex — works even before terminal PATH refresh
const PDFLATEX_PATHS = [
  'pdflatex',  // works after PATH is refreshed in a new terminal
  'C:\\Users\\raaju\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe'
];

// ── Check if pdflatex is available ───────────────────────────────────────────
function getPdflatexCmd() {
  for (const cmd of PDFLATEX_PATHS) {
    try {
      execSync(`"${cmd}" --version`, { stdio: 'pipe' });
      return cmd;
    } catch {
      // try next
    }
  }
  return null;
}

function isPdflatexAvailable() {
  return getPdflatexCmd() !== null;
}

// ── Compile LaTeX to PDF ─────────────────────────────────────────────────────
function compileLatexToPdf(texContent, filenameBase) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(GENERATED_DIR)) {
        fs.mkdirSync(GENERATED_DIR, { recursive: true });
      }

      const texPath = path.join(GENERATED_DIR, `${filenameBase}.tex`);
      const pdfPath = path.join(GENERATED_DIR, `${filenameBase}.pdf`);

      fs.writeFileSync(texPath, texContent, 'utf8');
      console.log(`📝 Saved LaTeX source to ${texPath}`);

      const pdflatexCmd = getPdflatexCmd();
      if (!pdflatexCmd) throw new Error('pdflatex not found — install MiKTeX or TeX Live');

      const args = ['-interaction=nonstopmode', `-output-directory=${GENERATED_DIR}`, texPath];

      // Run twice (second pass fixes cross-references / layout)
      for (let pass = 1; pass <= 2; pass++) {
        const result = spawnSync(pdflatexCmd, args, { timeout: 60000, encoding: 'utf8' });
        // MiKTeX exits with code 1 for "please update" warning even on success.
        // We determine success by whether the PDF file was created.
        const stderr = result.stderr || result.stdout || '';
        if (result.error) throw result.error;
        if (pass === 2 && !fs.existsSync(pdfPath)) {
          console.error('pdflatex output:\n', stderr.slice(-2000));
          throw new Error('pdflatex ran but PDF was not created — check the .log file');
        }
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      console.log(`✅ LaTeX compilation successful: ${pdfPath} (${pdfBuffer.length} bytes)`);

      // Clean up auxiliary files
      ['.aux', '.log', '.out'].forEach(ext => {
        const auxPath = path.join(GENERATED_DIR, `${filenameBase}${ext}`);
        if (fs.existsSync(auxPath)) fs.unlinkSync(auxPath);
      });

      resolve(pdfBuffer);
    } catch (error) {
      console.error('❌ LaTeX compilation failed:', error.message);
      reject(error);
    }
  });
}

// ── Main export: generate tailored resume PDF ────────────────────────────────
// originalData     = the selected resume's parsedData (all fields)
// rewrittenSections = ONLY the AI-rewritten sections in the new format:
//   { summary, skillCategories, experienceBullets, projects }
async function generateTailoredResumePdf(originalData, rewrittenSections, filenameBase) {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  // Save the data for debugging
  const jsonPath = path.join(GENERATED_DIR, `${filenameBase}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ originalData, rewrittenSections }, null, 2), 'utf8');

  if (isPdflatexAvailable()) {
    console.log('📄 Using LaTeX (pdflatex) for PDF generation...');
    const texContent = fillLatexTemplate(originalData, rewrittenSections);
    return compileLatexToPdf(texContent, filenameBase);
  }

  console.log('⚠️ pdflatex not found. Using pdfmake fallback.');
  console.log('   Install MiKTeX or TeX Live for LaTeX compilation.');
  // pdfmake fallback: pass a flattened skills array and first experience entry for compat
  const fallbackSections = {
    summary: rewrittenSections.summary,
    skills: rewrittenSections.skillCategories
      ? Object.values(rewrittenSections.skillCategories).flat()
      : [],
    experience: rewrittenSections.experienceBullets
      ? [{ achievements: rewrittenSections.experienceBullets }]
      : [],
    projects: (rewrittenSections.projects || []).map(p => ({
      description: (p.bullets || []).join(' ')
    })),
  };
  const pdfMakeDefinition = buildResumeDocument(originalData, fallbackSections);
  return compileJsonToPdf(pdfMakeDefinition, filenameBase);
}

module.exports = { generateTailoredResumePdf, fillLatexTemplate, isPdflatexAvailable };
