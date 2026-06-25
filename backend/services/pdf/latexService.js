const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { compileJsonToPdf } = require('./pdfService');
const { buildResumeDocument } = require('./resumeTemplate');
const { getUserGeneratedDir } = require('../userStorage');

const TEMPLATE_PATH = path.join(__dirname, '../../templates/resume.tex');

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

function normalizeUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return /^https?:\/\/[^\s{}\\]+$/i.test(url) ? url : '';
}

function formatContactLine(data) {
  const parts = [];
  if (data.phone) parts.push(`\\faMobile\\ ${escapeLatex(String(data.phone))}`);
  if (data.email) parts.push(`\\faEnvelope\\ ${escapeLatex(String(data.email))}`);
  if (data.location) parts.push(`\\faMapMarker\\ ${escapeLatex(String(data.location))}`);
  if (parts.length === 0) return '';
  return `\\textcolor{primary}{${parts.join('\n\\textcolor{accent}{$\\bullet$}\n')}}`;
}

function formatSocialLine(data) {
  const parts = [];
  const linkedIn = normalizeUrl(data.linkedIn);
  const github = normalizeUrl(data.github);
  const website = normalizeUrl(data.website);

  if (linkedIn) {
    parts.push(`\\faLinkedin\\ \\href{${linkedIn}}{LinkedIn}`);
  }
  if (github) {
    parts.push(`\\faGithub\\ \\href{${github}}{GitHub}`);
  }
  if (website) {
    parts.push(`\\faGlobe\\ \\href{${website}}{Portfolio}`);
  }

  return parts.join('\n\\textcolor{accent}{$\\bullet$}\n');
}

// ── Section header (title + underline rule) ──────────────────────────────────
function sectionHeader(title) {
  return `\\noindent\n\\textbf{\\large ${title}} \\\\\n\\rule{\\textwidth}{0.5pt}\n`;
}

// Build an ATS-friendly date range, ignoring garbage computed durations.
function formatExperienceDates(exp) {
  const range = [exp.startDate, exp.endDate].filter(Boolean).join(' -- ');
  if (range) return range;
  const duration = String(exp.duration || '').trim();
  if (duration && !/^0\s+years?\s+0\s+months?$/i.test(duration)) return duration;
  return '';
}

function bulletList(items) {
  const valid = (items || []).filter(b => b && String(b).trim());
  if (valid.length === 0) return '';
  return `\\begin{itemize}\n${valid.map(b => `\\item ${escapeLatex(String(b))}`).join('\n')}\n\\end{itemize}`;
}

// ── SUMMARY ──────────────────────────────────────────────────────────────────
function formatSummarySection(orig, ai) {
  const summary = ai.summary || orig.summary || '';
  if (!summary) return '';
  return `${sectionHeader('PROFESSIONAL SUMMARY')}\n${escapeLatex(summary)}\n\n\\vspace{0.3cm}\n`;
}

// ── SKILLS ───────────────────────────────────────────────────────────────────
function formatSkillsSection(orig, ai) {
  const rows = formatSkillsTabular(ai.skillCategories || orig.skills);
  if (!rows) return '';
  return `${sectionHeader('TECHNICAL SKILLS')}\n\\begin{tabular}{@{}p{0.30\\textwidth}p{0.65\\textwidth}@{}}\n${rows}\n\\end{tabular}\n\n\\vspace{0.3cm}\n`;
}

// ── EXPERIENCE (ALL roles, not just the most recent) ─────────────────────────
// experience[0] uses the AI-tailored bullets; older roles keep their original
// achievements so no real experience is dropped.
function formatExperienceSection(orig, ai) {
  const experiences = Array.isArray(orig.experience) ? orig.experience : [];
  if (experiences.length === 0) return '';

  const blocks = experiences.map((exp, i) => {
    const role = escapeLatex(exp.role || 'Professional Experience');
    const dates = escapeLatex(formatExperienceDates(exp));
    const companyLine = [exp.company, exp.location].filter(Boolean).map(escapeLatex).join(', ');

    const bullets = (i === 0 && Array.isArray(ai.experienceBullets) && ai.experienceBullets.length)
      ? ai.experienceBullets
      : (Array.isArray(exp.achievements) && exp.achievements.length
          ? exp.achievements
          : (exp.description ? [exp.description] : []));

    return `\\textbf{${role}}${dates ? ` \\hfill ${dates}` : ''} \\\\\n${companyLine}\n\n${bulletList(bullets)}`;
  });

  return `${sectionHeader('PROFESSIONAL EXPERIENCE')}\n${blocks.join('\n\n\\vspace{0.2cm}\n\n')}\n\n\\vspace{0.3cm}\n`;
}

// ── PROJECTS (ALL projects; GitHub link only when a REAL url exists) ──────────
function formatProjectsSection(orig, ai) {
  const projects = Array.isArray(orig.projects) ? orig.projects : [];
  if (projects.length === 0) return '';

  const blocks = projects.map((proj, i) => {
    const aiProj = ai.projects?.[i] || {};
    const name = escapeLatex(proj.name || aiProj.name || `Project ${i + 1}`);
    // URLs must be factual — use only the original resume's url, never AI-invented.
    const url = normalizeUrl(proj.url || proj.link);
    const linkText = url ? escapeLatex(url.replace(/^https?:\/\//, '')) : '';
    const linkPart = url ? ` \\hfill \\faGithub\\ \\href{${url}}{${linkText}}` : '';

    const tech = Array.isArray(proj.technologies) && proj.technologies.length
      ? `\\textit{${proj.technologies.map(escapeLatex).join(', ')}}\n\n`
      : '';

    const bullets = (Array.isArray(aiProj.bullets) && aiProj.bullets.length)
      ? aiProj.bullets
      : (Array.isArray(proj.achievements) && proj.achievements.length
          ? proj.achievements
          : (proj.description ? [proj.description] : []));

    return `\\textbf{${name}}${linkPart} \\\\\n${tech}${bulletList(bullets)}`;
  });

  return `${sectionHeader('PROJECTS')}\n${blocks.join('\n\n\\vspace{0.2cm}\n\n')}\n\n\\vspace{0.3cm}\n`;
}

// Build education year/range from parsed fields (prefers full range as written).
function formatEducationYear(edu) {
  if (!edu) return '';
  if (edu.yearRange) return String(edu.yearRange).trim();
  const start = edu.startYear;
  const end = edu.endYear || edu.graduationYear || edu.year;
  if (start && end) return `${start} – ${end}`;
  if (end) return String(end).trim();
  if (start) return String(start).trim();
  return '';
}

// ── EDUCATION ────────────────────────────────────────────────────────────────
function formatEducationSection(data) {
  const education = Array.isArray(data.education) ? data.education : [];
  if (education.length === 0) return '';

  const rows = education.map((edu, index) => {
    const institution = escapeLatex(edu.institution || '');
    const degree = escapeLatex(edu.degree || 'Degree');
    const year = escapeLatex(formatEducationYear(edu));
    const spacing = index < education.length - 1 ? '[0.2cm]' : '';

    // Institution + dates on first line, degree below (matches common resume layout).
    if (institution) {
      const degreeLine = degree ? `\n${degree}` : '';
      return `\\textbf{${institution}}${year ? ` & \\hfill ${year}` : ''} \\\\${degreeLine} \\\\${spacing}`;
    }
    return `\\textbf{${degree}}${year ? ` & \\hfill ${year}` : ''} \\\\${spacing}`;
  });

  const table = `\\begin{tabular}{@{}p{0.75\\textwidth}p{0.23\\textwidth}@{}}\n${rows.join('\n\n')}\n\\end{tabular}`;
  return `${sectionHeader('EDUCATION')}\n${table}\n\n\\vspace{0.3cm}\n`;
}

// ── RELEVANT COURSEWORK (collected from all education entries) ────────────────
function formatCourseworkSection(data) {
  const education = Array.isArray(data.education) ? data.education : [];
  const courses = [];
  for (const edu of education) {
    if (Array.isArray(edu.relevantCourses)) courses.push(...edu.relevantCourses);
  }
  if (Array.isArray(data.coursework)) courses.push(...data.coursework);

  const unique = [...new Set(courses.map(c => String(c).trim()).filter(Boolean))];
  if (unique.length === 0) return '';

  return `${sectionHeader('RELEVANT COURSEWORK')}\n${escapeLatex(unique.join(', '))}\n\n\\vspace{0.3cm}\n`;
}

// ── CERTIFICATIONS (section hidden entirely when empty) ───────────────────────
function formatCertificationsSection(data) {
  const certifications = Array.isArray(data.certifications) ? data.certifications : [];
  const valid = certifications.map(c => String(c).trim()).filter(Boolean);
  if (valid.length === 0) return '';
  return `${sectionHeader('CERTIFICATIONS')}\n${bulletList(valid)}\n`;
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

  // Build each section once.
  const sectionBuilders = {
    summary:        () => formatSummarySection(orig, ai),
    skills:         () => formatSkillsSection(orig, ai),
    experience:     () => formatExperienceSection(orig, ai),
    projects:       () => formatProjectsSection(orig, ai),
    education:      () => formatEducationSection(orig),
    coursework:     () => formatCourseworkSection(orig),
    certifications: () => formatCertificationsSection(orig),
  };

  // Follow the candidate's original section order when available, then append any
  // sections they didn't have in that list so nothing is ever dropped.
  const defaultOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'coursework', 'certifications'];
  const order = Array.isArray(orig.sectionOrder) && orig.sectionOrder.length
    ? orig.sectionOrder.filter(k => sectionBuilders[k])
    : [...defaultOrder];
  for (const key of defaultOrder) {
    if (!order.includes(key)) order.push(key);
  }

  const body = order.map(key => sectionBuilders[key]()).filter(Boolean).join('\n');

  const replacements = {
    '{{NAME}}':         escapeLatex(orig.name || 'Candidate Name'),
    '{{CONTACT_LINE}}': formatContactLine(orig),
    '{{SOCIAL_LINE}}':  formatSocialLine(orig),
    '{{BODY}}':         body,
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(escapeRegex(placeholder), 'g'), () => value);
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
function compileLatexToPdf(texContent, filenameBase, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const texPath = path.join(outputDir, `${filenameBase}.tex`);
      const pdfPath = path.join(outputDir, `${filenameBase}.pdf`);

      fs.writeFileSync(texPath, texContent, 'utf8');
      console.log(`📝 Saved LaTeX source to ${texPath}`);

      const pdflatexCmd = getPdflatexCmd();
      if (!pdflatexCmd) throw new Error('pdflatex not found — install MiKTeX or TeX Live');

      const args = ['-interaction=nonstopmode', `-output-directory=${outputDir}`, texPath];

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
        const auxPath = path.join(outputDir, `${filenameBase}${ext}`);
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
async function generateTailoredResumePdf(userId, originalData, rewrittenSections, filenameBase) {
  const outputDir = getUserGeneratedDir(userId);

  // Save the data for debugging
  const jsonPath = path.join(outputDir, `${filenameBase}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ originalData, rewrittenSections }, null, 2), 'utf8');

  if (isPdflatexAvailable()) {
    console.log('📄 Using LaTeX (pdflatex) for PDF generation...');
    const texContent = fillLatexTemplate(originalData, rewrittenSections);
    return compileLatexToPdf(texContent, filenameBase, outputDir);
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
  return compileJsonToPdf(pdfMakeDefinition, filenameBase, outputDir);
}

module.exports = { generateTailoredResumePdf, fillLatexTemplate, isPdflatexAvailable };
