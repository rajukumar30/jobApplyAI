const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { compileJsonToPdf } = require('./pdfService');
const { buildResumeDocument } = require('./resumeTemplate');
const { getUserGeneratedDir } = require('../userStorage');
const { escapeLatex, escapeRegex } = require('./latexEscape');
const { highlightKeywordsInText } = require('./keywordHighlighter');
const { getFormatById, FORMATS_DIR } = require('./formatRegistry');
const { buildResumeTex } = require('./formatBuilders');

const LEGACY_TEMPLATE_PATH = path.join(__dirname, '../../templates/resume.tex');

// ── Contact / social lines ───────────────────────────────────────────────────
function normalizeUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return /^https?:\/\/[^\s{}\\]+$/i.test(url) ? url : '';
}

function formatContactLine(data, style = 'icons') {
  if (style === 'plain') {
    const parts = [];
    if (data.phone) parts.push(escapeLatex(String(data.phone)));
    if (data.email) parts.push(escapeLatex(String(data.email)));
    if (data.location) parts.push(escapeLatex(String(data.location)));
    return parts.join(' \\textbar{} ');
  }

  const parts = [];
  if (data.phone) parts.push(`\\faMobile\\ ${escapeLatex(String(data.phone))}`);
  if (data.email) parts.push(`\\faEnvelope\\ ${escapeLatex(String(data.email))}`);
  if (data.location) parts.push(`\\faMapMarker\\ ${escapeLatex(String(data.location))}`);
  if (parts.length === 0) return '';
  return `\\textcolor{primary}{${parts.join('\n\\textcolor{accent}{$\\bullet$}\n')}}`;
}

function formatSocialLine(data, style = 'icons') {
  const parts = [];
  const linkedIn = normalizeUrl(data.linkedIn);
  const github = normalizeUrl(data.github);
  const website = normalizeUrl(data.website);

  if (linkedIn) {
    parts.push(style === 'plain'
      ? `LinkedIn: \\href{${linkedIn}}{${escapeLatex(linkedIn.replace(/^https?:\/\//, ''))}}`
      : `\\faLinkedin\\ \\href{${linkedIn}}{LinkedIn}`);
  }
  if (github) {
    parts.push(style === 'plain'
      ? `GitHub: \\href{${github}}{${escapeLatex(github.replace(/^https?:\/\//, ''))}}`
      : `\\faGithub\\ \\href{${github}}{GitHub}`);
  }
  if (website) {
    parts.push(style === 'plain'
      ? `Portfolio: \\href{${website}}{${escapeLatex(website.replace(/^https?:\/\//, ''))}}`
      : `\\faGlobe\\ \\href{${website}}{Portfolio}`);
  }

  if (parts.length === 0) return '';
  const sep = style === 'plain' ? ' \\textbar{} ' : '\n\\textcolor{accent}{$\\bullet$}\n';
  return style === 'plain' ? parts.join(sep) : parts.join(sep);
}

// ── Section helpers ──────────────────────────────────────────────────────────
function sectionHeader(title, formatId) {
  if (formatId === 'ats-classic') {
    return `\\section*{${title}}\n`;
  }
  if (formatId === 'minimal') {
    return `\\vspace{0.3cm}\n{\\large\\textbf{${title}}}\\\\\n{\\color{muted}\\rule{\\textwidth}{0.4pt}}\n\\vspace{0.15cm}\n`;
  }
  return `\\noindent\n\\textbf{\\large ${title}} \\\\\n\\rule{\\textwidth}{0.5pt}\n`;
}

function formatExperienceDates(exp) {
  const range = [exp.startDate, exp.endDate].filter(Boolean).join(' -- ');
  if (range) return range;
  const duration = String(exp.duration || '').trim();
  if (duration && !/^0\s+years?\s+0\s+months?$/i.test(duration)) return duration;
  return '';
}

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

function createTextProcessor(highlightKeywords) {
  const keywords = Array.isArray(highlightKeywords) ? highlightKeywords : [];
  return (text) => {
    if (!text) return '';
    return keywords.length ? highlightKeywordsInText(text, keywords) : escapeLatex(String(text));
  };
}

function bulletList(items, processText) {
  const valid = (items || []).filter((b) => b && String(b).trim());
  if (valid.length === 0) return '';
  return `\\begin{itemize}\n${valid.map((b) => `\\item ${processText(String(b))}`).join('\n')}\n\\end{itemize}`;
}

function formatSkillsTabular(skillCategoriesOrArray) {
  if (!skillCategoriesOrArray) return '';

  let categories;
  if (Array.isArray(skillCategoriesOrArray)) {
    const total = skillCategoriesOrArray.length;
    const colSize = Math.ceil(total / 3);
    categories = {
      'Core Skills': skillCategoriesOrArray.slice(0, colSize),
      'Technical Tools': skillCategoriesOrArray.slice(colSize, colSize * 2),
      'Other Skills': skillCategoriesOrArray.slice(colSize * 2),
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

function formatSkillsLines(skillCategoriesOrArray) {
  if (!skillCategoriesOrArray) return '';

  let categories;
  if (Array.isArray(skillCategoriesOrArray)) {
    const total = skillCategoriesOrArray.length;
    const colSize = Math.ceil(total / 3);
    categories = {
      Languages: skillCategoriesOrArray.slice(0, colSize),
      Tools: skillCategoriesOrArray.slice(colSize, colSize * 2),
      Other: skillCategoriesOrArray.slice(colSize * 2),
    };
  } else {
    categories = skillCategoriesOrArray;
  }

  return Object.entries(categories)
    .filter(([, skills]) => Array.isArray(skills) && skills.length > 0)
    .map(([cat, skills]) =>
      `\\textbf{${escapeLatex(cat)}:} ${skills.map(escapeLatex).join(', ')}`
    )
    .join(' \\\\\n');
}

// ── Section builders ─────────────────────────────────────────────────────────
function buildSectionFormatters(orig, ai, formatId, highlightKeywords) {
  const processText = createTextProcessor(
    getFormatById(formatId).supportsKeywordBold ? highlightKeywords : []
  );
  const contactStyle = formatId === 'ats-classic' ? 'plain' : 'icons';
  const useTwocol = formatId === 'ats-classic';
  const useSkillLines = formatId === 'ats-classic';

  return {
    formatSummarySection() {
      const summary = ai.summary || orig.summary || '';
      if (!summary) return '';
      const title = formatId === 'ats-classic' ? 'Summary' : 'PROFESSIONAL SUMMARY';
      return `${sectionHeader(title, formatId)}\n${processText(summary)}\n\n\\vspace{0.2cm}\n`;
    },

    formatSkillsSection() {
      const skills = ai.skillCategories || orig.skills;
      if (useSkillLines) {
        const lines = formatSkillsLines(skills);
        if (!lines) return '';
        return `${sectionHeader('Skills', formatId)}\n${lines}\n\n\\vspace{0.2cm}\n`;
      }
      const rows = formatSkillsTabular(skills);
      if (!rows) return '';
      return `${sectionHeader('TECHNICAL SKILLS', formatId)}\n\\begin{tabular}{@{}p{0.30\\textwidth}p{0.65\\textwidth}@{}}\n${rows}\n\\end{tabular}\n\n\\vspace{0.3cm}\n`;
    },

    formatExperienceSection() {
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

        if (useTwocol) {
          const header = dates
            ? `\\twocolentry{\\textbf{${role}}}{${dates}}`
            : `\\textbf{${role}}\\\\`;
          return `${header}\n\\textit{${companyLine}}\n\n${bulletList(bullets, processText)}`;
        }

        return `\\textbf{${role}}${dates ? ` \\hfill ${dates}` : ''} \\\\\n${companyLine}\n\n${bulletList(bullets, processText)}`;
      });

      const title = formatId === 'ats-classic' ? 'Experience' : 'PROFESSIONAL EXPERIENCE';
      const gap = formatId === 'compact' ? '\\vspace{0.1cm}' : '\\vspace{0.2cm}';
      return `${sectionHeader(title, formatId)}\n${blocks.join(`\n\n${gap}\n\n`)}\n\n\\vspace{0.2cm}\n`;
    },

    formatProjectsSection() {
      const projects = Array.isArray(orig.projects) ? orig.projects : [];
      if (projects.length === 0) return '';

      const blocks = projects.map((proj, i) => {
        const aiProj = ai.projects?.[i] || {};
        const name = escapeLatex(proj.name || aiProj.name || `Project ${i + 1}`);
        const url = normalizeUrl(proj.url || proj.link);
        const linkText = url ? escapeLatex(url.replace(/^https?:\/\//, '')) : '';
        const linkPart = url
          ? (formatId === 'ats-classic'
            ? ` \\hfill \\href{${url}}{${linkText}}`
            : ` \\hfill \\faGithub\\ \\href{${url}}{${linkText}}`)
          : '';

        const tech = Array.isArray(proj.technologies) && proj.technologies.length
          ? `\\textit{${proj.technologies.map(escapeLatex).join(', ')}}\n\n`
          : '';

        const bullets = (Array.isArray(aiProj.bullets) && aiProj.bullets.length)
          ? aiProj.bullets
          : (Array.isArray(proj.achievements) && proj.achievements.length
            ? proj.achievements
            : (proj.description ? [proj.description] : []));

        return `\\textbf{${name}}${linkPart} \\\\\n${tech}${bulletList(bullets, processText)}`;
      });

      return `${sectionHeader('PROJECTS', formatId)}\n${blocks.join('\n\n\\vspace{0.2cm}\n\n')}\n\n\\vspace{0.2cm}\n`;
    },

    formatEducationSection() {
      const education = Array.isArray(orig.education) ? orig.education : [];
      if (education.length === 0) return '';

      const rows = education.map((edu, index) => {
        const institution = escapeLatex(edu.institution || '');
        const degree = escapeLatex(edu.degree || 'Degree');
        const year = escapeLatex(formatEducationYear(edu));
        const spacing = index < education.length - 1 ? '[0.2cm]' : '';

        if (useTwocol && institution) {
          const degreeLine = degree ? `\n${degree}` : '';
          return year
            ? `\\twocolentry{\\textbf{${institution}}}{${year}}${degreeLine} \\\\${spacing}`
            : `\\textbf{${institution}}\\\\${degreeLine} \\\\${spacing}`;
        }

        if (institution) {
          const degreeLine = degree ? `\n${degree}` : '';
          return `\\textbf{${institution}}${year ? ` & \\hfill ${year}` : ''} \\\\${degreeLine} \\\\${spacing}`;
        }
        return `\\textbf{${degree}}${year ? ` & \\hfill ${year}` : ''} \\\\${spacing}`;
      });

      const table = `\\begin{tabular}{@{}p{0.75\\textwidth}p{0.23\\textwidth}@{}}\n${rows.join('\n\n')}\n\\end{tabular}`;
      const title = formatId === 'ats-classic' ? 'Education' : 'EDUCATION';
      return `${sectionHeader(title, formatId)}\n${table}\n\n\\vspace{0.2cm}\n`;
    },

    formatCourseworkSection() {
      const education = Array.isArray(orig.education) ? orig.education : [];
      const courses = [];
      for (const edu of education) {
        if (Array.isArray(edu.relevantCourses)) courses.push(...edu.relevantCourses);
      }
      if (Array.isArray(orig.coursework)) courses.push(...orig.coursework);

      const unique = [...new Set(courses.map((c) => String(c).trim()).filter(Boolean))];
      if (unique.length === 0) return '';

      return `${sectionHeader('RELEVANT COURSEWORK', formatId)}\n${escapeLatex(unique.join(', '))}\n\n\\vspace{0.2cm}\n`;
    },

    formatCertificationsSection() {
      const certifications = Array.isArray(orig.certifications) ? orig.certifications : [];
      const valid = certifications.map((c) => String(c).trim()).filter(Boolean);
      if (valid.length === 0) return '';
      return `${sectionHeader('CERTIFICATIONS', formatId)}\n${bulletList(valid, escapeLatex)}\n`;
    },

    contactStyle,
  };
}

function fillLatexTemplate(originalData, rewrittenSections, options = {}) {
  return buildResumeTex(originalData, rewrittenSections, options);
}

// ── pdflatex ───────────────────────────────────────────────────────────────────
const PDFLATEX_PATHS = [
  'pdflatex',
  'C:\\Users\\raaju\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe',
];

const XELATEX_PATHS = [
  'xelatex',
  'C:\\Users\\raaju\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe',
];

function getLatexCmd(paths) {
  for (const cmd of paths) {
    try {
      execSync(`"${cmd}" --version`, { stdio: 'pipe' });
      return cmd;
    } catch {
      // try next
    }
  }
  return null;
}

function getPdflatexCmd() {
  return getLatexCmd(PDFLATEX_PATHS);
}

function getXelatexCmd() {
  return getLatexCmd(XELATEX_PATHS);
}

function getEngineForFormat() {
  return 'pdflatex';
}

function isPdflatexAvailable() {
  return getPdflatexCmd() !== null;
}

function isXelatexAvailable() {
  return getXelatexCmd() !== null;
}

function compileLatexToPdf(texContent, filenameBase, outputDir, engine = 'pdflatex') {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const texPath = path.join(outputDir, `${filenameBase}.tex`);
      const pdfPath = path.join(outputDir, `${filenameBase}.pdf`);

      fs.writeFileSync(texPath, texContent, 'utf8');
      console.log(`📝 Saved LaTeX source to ${texPath}`);

      const latexCmd = engine === 'xelatex' ? getXelatexCmd() : getPdflatexCmd();
      if (!latexCmd) throw new Error(`${engine} not found — install MiKTeX or TeX Live`);

      const args = ['-interaction=nonstopmode', `-output-directory=${outputDir}`, texPath];

      for (let pass = 1; pass <= 2; pass++) {
        const result = spawnSync(latexCmd, args, { timeout: 180000, encoding: 'utf8' });
        const stderr = result.stderr || result.stdout || '';
        if (result.error) throw result.error;
        if (pass === 2 && !fs.existsSync(pdfPath)) {
          console.error(`${engine} output:\n`, stderr.slice(-2500));
          const logPath = path.join(outputDir, `${filenameBase}.log`);
          if (fs.existsSync(logPath)) {
            console.error(fs.readFileSync(logPath, 'utf8').slice(-2500));
          }
          throw new Error(`${engine} ran but PDF was not created — check the .log file`);
        }
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      console.log(`✅ LaTeX compilation successful: ${pdfPath} (${pdfBuffer.length} bytes)`);

      ['.aux', '.log', '.out'].forEach((ext) => {
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

async function generateTailoredResumePdf(userId, originalData, rewrittenSections, filenameBase, options = {}) {
  const outputDir = getUserGeneratedDir(userId);
  const formatId = options.formatId || 'ats-classic';
  const highlightKeywords = options.highlightKeywords || [];

  const jsonPath = path.join(outputDir, `${filenameBase}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ originalData, rewrittenSections, formatId, collegeTierInfo: options.collegeTierInfo }, null, 2), 'utf8');

  if (isPdflatexAvailable()) {
    const engine = getEngineForFormat(formatId);
    console.log(`📄 Using LaTeX (${engine}) format=${formatId}...`);
    const texContent = fillLatexTemplate(originalData, rewrittenSections, { formatId, highlightKeywords, collegeTierInfo: options.collegeTierInfo });
    if (formatId === 'professional-cv') {
      const clsSrc = path.join(FORMATS_DIR, 'resume.cls');
      const clsDest = path.join(outputDir, 'resume.cls');
      if (fs.existsSync(clsSrc)) fs.copyFileSync(clsSrc, clsDest);
    }
    return compileLatexToPdf(texContent, filenameBase, outputDir, engine);
  }

  console.log('⚠️ pdflatex not found. Using pdfmake fallback.');
  const fallbackSections = {
    summary: rewrittenSections.summary,
    skills: rewrittenSections.skillCategories
      ? Object.values(rewrittenSections.skillCategories).flat()
      : [],
    experience: rewrittenSections.experienceBullets
      ? [{ achievements: rewrittenSections.experienceBullets }]
      : [],
    projects: (rewrittenSections.projects || []).map((p) => ({
      description: (p.bullets || []).join(' '),
    })),
  };
  const pdfMakeDefinition = buildResumeDocument(originalData, fallbackSections);
  return compileJsonToPdf(pdfMakeDefinition, filenameBase, outputDir);
}

module.exports = {
  generateTailoredResumePdf,
  fillLatexTemplate,
  isPdflatexAvailable,
  isXelatexAvailable,
  compileLatexToPdf,
  getEngineForFormat,
};
