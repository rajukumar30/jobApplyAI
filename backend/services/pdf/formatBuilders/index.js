const fs = require('fs');
const path = require('path');
const { escapeLatex } = require('../latexEscape');
const { highlightKeywordsInText } = require('../keywordHighlighter');
const {
  splitEducation,
  getPrimaryCollege,
  shouldPlaceEducationAtTop,
  getSectionOrder,
} = require('../educationUtils');
const { resolveSkillCategories, cleanExperienceBullet, mergeSkillCategories } = require('../skillsUtils');

const FORMATS_DIR = path.join(__dirname, '../../../templates/formats');

function processText(text, highlightKeywords) {
  if (!text) return '';
  return highlightKeywords?.length
    ? highlightKeywordsInText(text, highlightKeywords)
    : escapeLatex(String(text));
}

function normalizeUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return /^https?:\/\/[^\s{}\\]+$/i.test(url) ? url : '';
}

function bulletList(items, process) {
  const valid = (items || []).filter((b) => b && String(b).trim());
  if (!valid.length) return '';
  return valid.map((b) => `\\item ${process(String(b))}`).join('\n');
}

function formatYear(edu) {
  if (!edu) return '';
  if (edu.yearRange) return String(edu.yearRange).trim();
  const end = edu.endYear || edu.graduationYear || edu.year;
  const start = edu.startYear;
  if (start && end) return `${start} – ${end}`;
  return end ? String(end) : (start ? String(start) : '');
}

function formatGpa(edu) {
  return edu.gpa ? escapeLatex(String(edu.gpa)) : '';
}

function buildSkillsCategories(ai, orig) {
  return mergeSkillCategories(orig, ai);
}

function sectionAts(title) {
  return `\\section{${title}}\n`;
}

function sectionIiit(title) {
  return `\\section{\\textbf{${title}}}\n`;
}

function sectionHarshibar(title) {
  return `\\section{${title.toUpperCase()}}\n  \\resumeSubHeadingListStart\n`;
}

function endHarshibar() {
  return '  \\resumeSubHeadingListEnd\n';
}

function sectionProfessional(title) {
  return `\\begin{rSection}{${title}}\n`;
}

function endProfessional() {
  return '\\end{rSection}\n';
}

function buildEducationBlocks(formatId, orig) {
  const { college, class10, class12 } = splitEducation(orig.education);
  const blocks = [];

  for (const edu of college) {
    const inst = escapeLatex(edu.institution || '');
    const degree = escapeLatex(edu.degree || '');
    const year = escapeLatex(formatYear(edu));
    const gpa = formatGpa(edu);

    if (formatId === 'ats-classic') {
      blocks.push(
        year
          ? `\\textbf{${inst}} \\hfill \\textbf{${year}} \\\\\n${degree}`
          : `\\textbf{${inst}} \\\\\n${degree}`
      );
    } else if (formatId === 'harshibar') {
      blocks.push(
        `    \\resumeSubheading\n      {${inst}}{${year}}\n      {${degree}}{${gpa}}\n`
      );
    } else if (formatId === 'iiit-boxed') {
      const score = gpa || '';
      blocks.push(
        `    \\resumeSubheading\n      {${inst}}{${score}}\n      {${degree}}{${year}}\n`
      );
    } else if (formatId === 'professional-cv') {
      blocks.push(
        `{\\bf ${degree}} \\hfill {${year}}\n\\\\\n${inst}${gpa ? ` \\\\\nCGPA: ${gpa}` : ''}\n`
      );
    }
  }

  for (const edu of class12) {
    const inst = escapeLatex(edu.institution || edu.board || 'Higher Secondary');
    const degree = escapeLatex(edu.degree || 'Class XII');
    const year = escapeLatex(formatYear(edu));
    const score = formatGpa(edu);

    if (formatId === 'professional-cv') {
      blocks.push(`{\\bf ${degree}} \\hfill {${year}}\n\\\\\n${inst}${score ? `, ${score}` : ''}\n`);
    } else if (formatId === 'iiit-boxed') {
      blocks.push(`    \\resumeSubheading\n      {${inst}}{${score}}\n      {${degree}}{${year}}\n`);
    }
  }

  for (const edu of class10) {
    const inst = escapeLatex(edu.institution || edu.board || 'Secondary School');
    const degree = escapeLatex(edu.degree || 'Class X');
    const year = escapeLatex(formatYear(edu));
    const score = formatGpa(edu);

    if (formatId === 'professional-cv') {
      blocks.push(`{\\textbf{${degree}}}  \\hfill{${year}}\n\\\\\n${inst}${score ? `, ${score}` : ''}\n`);
    } else if (formatId === 'iiit-boxed') {
      blocks.push(`    \\resumeSubheading\n      {${inst}}{${score}}\n      {${degree}}{${year}}\n`);
    }
  }

  return blocks.join('\n');
}

function buildExperience(formatId, orig, ai, process) {
  const exps = Array.isArray(orig.experience) ? orig.experience : [];
  if (!exps.length) return '';

  return exps.map((exp, i) => {
    const role = escapeLatex(exp.role || 'Role');
    const company = escapeLatex(exp.company || '');
    const location = escapeLatex(exp.location || '');
    const dates = escapeLatex([exp.startDate, exp.endDate].filter(Boolean).join(' -- ') || exp.duration || '');
    const rawBullets = (i === 0 && ai.experienceBullets?.length)
      ? ai.experienceBullets
      : (exp.achievements?.length ? exp.achievements : (exp.description ? [exp.description] : []));
    let bullets = rawBullets.map((b) => cleanExperienceBullet(b)).filter(Boolean);

    if (formatId === 'ats-classic') {
      const header = dates
        ? `\\textbf{${role}} \\hfill \\textbf{${dates}} \\\\\n\\textit{${company}}${location ? ` \\hfill \\textit{${location}}` : ''}`
        : `\\textbf{${role}} \\\\\n\\textit{${company}}`;
      return `${header}\n\\begin{itemize}\n${bulletList(bullets, process)}\n\\end{itemize}\n\\vspace{0.1em}`;
    }
    if (formatId === 'harshibar') {
      return `    \\resumeSubheading\n      {${company}}{${dates}}\n      {${role}}{${location}}\n      \\resumeItemListStart\n${bullets.map((b) => `        \\resumeItem{${process(String(b))}}`).join('\n')}\n      \\resumeItemListEnd\n`;
    }
    if (formatId === 'iiit-boxed') {
      return `    \\resumeSubheading\n      {${company}}{${location}}\n      {${role}}{${dates}}\n      \\vspace{-2.0mm}\n      \\resumeItemListStart\n${bullets.map((b) => `    \\item {${process(String(b))}}`).join('\n')}\n    \\resumeItemListEnd\n`;
    }
    if (formatId === 'professional-cv') {
      return `\\begin{rSubsection}{${company}}{${dates}}{${role}}{${location}}\n${bullets.map((b) => `\\item ${process(String(b))}`).join('\n')}\n\\end{rSubsection}\n`;
    }
    return '';
  }).join('\n');
}

function buildProjects(formatId, orig, ai, process) {
  const projects = Array.isArray(orig.projects) ? orig.projects : [];
  if (!projects.length) return '';

  return projects.map((proj, i) => {
    const aiProj = ai.projects?.[i] || {};
    const name = escapeLatex(proj.name || aiProj.name || `Project ${i + 1}`);
    const tech = (proj.technologies || []).map(escapeLatex).join(', ');
    const bullets = (aiProj.bullets?.length)
      ? aiProj.bullets
      : (proj.achievements?.length ? proj.achievements : (proj.description ? [proj.description] : []));

    if (formatId === 'ats-classic') {
      const items = [...bullets];
      if (tech) items.unshift(`Tools & technologies used: ${(proj.technologies || []).join(', ')}`);
      return `\\textbf{${name}}\n\\begin{itemize}\n${bulletList(items, process)}\n\\end{itemize}\n\\vspace{0.1em}`;
    }
    if (formatId === 'harshibar') {
      return `      \\resumeProjectHeading\n          {\\textbf{${name}}}{}\n          \\resumeItemListStart\n${bullets.map((b) => `            \\resumeItem{${process(String(b))}}`).join('\n')}\n          \\resumeItemListEnd\n`;
    }
    if (formatId === 'iiit-boxed') {
      const dates = escapeLatex(
        [proj.startDate, proj.endDate].filter(Boolean).join(' -- ')
          || formatYear(proj)
          || ''
      );
      const rawDesc = String(proj.description || proj.impact || '').trim();
      const joinedBullets = bullets.map((b) => String(b).trim()).join(' ');
      const descLooksLikeBullets = rawDesc && joinedBullets && rawDesc === joinedBullets;
      const shortDesc = rawDesc && !descLooksLikeBullets && rawDesc.length <= 120
        ? escapeLatex(rawDesc)
        : '';
      const bulletLines = [];
      if (tech) {
        bulletLines.push(`        \\item {Tools \\& technologies used: ${tech}}`);
      }
      for (const b of bullets) {
        bulletLines.push(`        \\item {${process(String(b))}}`);
      }
      return `    \\resumeProject\n      {${name}}\n      {${shortDesc}}\n      {${dates}}\n      {}\n      \\vspace{-2.0mm}\n      \\resumeItemListStart\n${bulletLines.join('\n')}\n    \\resumeItemListEnd\n`;
    }
    if (formatId === 'professional-cv') {
      return `\\begin{rSubsection}{${name}}{}{}{}\n${bullets.map((b) => `\\item ${process(String(b))}`).join('\n')}\n\\end{rSubsection}\n`;
    }
    return '';
  }).join('\n');
}

function buildSkills(formatId, ai, orig) {
  const cats = buildSkillsCategories(ai, orig);
  const entries = Object.entries(cats).filter(([, v]) => Array.isArray(v) && v.length);
  if (!entries.length) return '';

  if (formatId === 'ats-classic') {
    return entries.map(([cat, skills]) =>
      `\\textbf{${escapeLatex(cat)}:} ${skills.map(escapeLatex).join(', ')}`
    ).join(' \\\\\n');
  }
  if (formatId === 'harshibar') {
    return ` \\begin{itemize}[leftmargin=0in, label={}]\n    \\small{\\item{\n${entries.map(([cat, skills]) =>
      `     \\textbf{${escapeLatex(cat)}} {: ${skills.map(escapeLatex).join(', ')}}\\vspace{2pt} \\\\`
    ).join('\n')}\n    }}\n \\end{itemize}\n`;
  }
  if (formatId === 'iiit-boxed') {
    return ` \\begin{itemize}[leftmargin=0.05in, label={}]\n    \\small{\\item{\n${entries.map(([cat, skills]) =>
      `     \\textbf{${escapeLatex(cat)}}{: ${skills.map(escapeLatex).join(', ')}} \\\\`
    ).join('\n')}\n    }}\n \\end{itemize}\n \\vspace{-8pt}\n`;
  }
  if (formatId === 'professional-cv') {
    return entries.map(([cat, skills]) =>
      `{\\bf ${escapeLatex(cat)}:} ${skills.map(escapeLatex).join(', ')} \\\\`
    ).join('\n');
  }
  return '';
}

function assembleBody(formatId, orig, ai, options) {
  const highlightKeywords = options.highlightKeywords || [];
  const tierInfo = options.collegeTierInfo;
  const process = (t) => processText(t, getFormatById(formatId).supportsKeywordBold ? highlightKeywords : []);
  const educationPosition = shouldPlaceEducationAtTop(tierInfo) ? 'top' : 'bottom';
  const order = getSectionOrder(formatId, educationPosition);

  const sections = {
    summary: () => {
      const summary = ai.summary || orig.summary || '';
      if (!summary) return '';
      const text = process(summary);
      if (formatId === 'ats-classic') return `${sectionAts('PROFESSIONAL SUMMARY')}${text}\n`;
      return '';
    },
    education: () => {
      const body = buildEducationBlocks(formatId, orig);
      if (!body) return '';
      if (formatId === 'ats-classic') return `${sectionAts('EDUCATION')}${body}\n`;
      if (formatId === 'harshibar') return `${sectionHarshibar('Education')}${body}${endHarshibar()}`;
      if (formatId === 'iiit-boxed') return `${sectionIiit('Education')}\n  \\resumeSubHeadingListStart\n${body}\n  \\resumeSubHeadingListEnd\n\\vspace{-5.5mm}\n`;
      if (formatId === 'professional-cv') return `${sectionProfessional('Education')}${body}${endProfessional()}`;
      return body;
    },
    skills: () => {
      const body = buildSkills(formatId, ai, orig);
      if (!body) return '';
      if (formatId === 'ats-classic') return `${sectionAts('TECHNICAL SKILLS')}${body}\n`;
      if (formatId === 'harshibar') return `\\section{SKILLS}\n${body}`;
      if (formatId === 'iiit-boxed') return `${sectionIiit('Technical Skills and Interests')}${body}`;
      if (formatId === 'professional-cv') return `${sectionProfessional('skills and INTERESTS')}${body}${endProfessional()}`;
      return body;
    },
    experience: () => {
      const body = buildExperience(formatId, orig, ai, process);
      if (!body) return '';
      if (formatId === 'ats-classic') return `${sectionAts('EXPERIENCE')}${body}\n`;
      if (formatId === 'harshibar') return `${sectionHarshibar('Experience')}${body}${endHarshibar()}`;
      if (formatId === 'iiit-boxed') return `${sectionIiit('Experience')}\n  \\resumeSubHeadingListStart\n${body}\n  \\resumeSubHeadingListEnd\n\\vspace{-8.5mm}\n`;
      if (formatId === 'professional-cv') return `${sectionProfessional('EXPERIENCE')}${body}${endProfessional()}`;
      return body;
    },
    projects: () => {
      const body = buildProjects(formatId, orig, ai, process);
      if (!body) return '';
      if (formatId === 'ats-classic') return `${sectionAts('PROJECTS')}${body}\n`;
      if (formatId === 'harshibar') return `${sectionHarshibar('Projects')}${body}${endHarshibar()}`;
      if (formatId === 'iiit-boxed') return `${sectionIiit('Personal Projects')}\n  \\resumeSubHeadingListStart\n${body}\n  \\resumeSubHeadingListEnd\n\\vspace{-5.5mm}\n`;
      if (formatId === 'professional-cv') return `${sectionProfessional('PROJECTS')}${body}${endProfessional()}`;
      return body;
    },
    coursework: () => '',
    certifications: () => {
      const certs = (orig.certifications || []).filter(Boolean);
      if (!certs.length) return '';
      const body = bulletList(certs, escapeLatex);
      if (formatId === 'ats-classic') return `${sectionAts('CERTIFICATIONS')}\\begin{itemize}\n${body}\n\\end{itemize}\n`;
      return '';
    },
  };

  return order.map((k) => sections[k]?.() || '').filter(Boolean).join('\n');
}

function getFormatById(formatId) {
  const { getFormatById: get } = require('../formatRegistry');
  return get(formatId);
}

function readPreamble(filename) {
  const content = fs.readFileSync(path.join(FORMATS_DIR, filename), 'utf8');
  const idx = content.indexOf('\\begin{document}');
  const preamble = idx >= 0 ? content.slice(0, idx) : content;
  return `${preamble.trimEnd()}\n`;
}

function documentFontBootstrap(formatId) {
  switch (formatId) {
    case 'harshibar':
      return '\\renewcommand*\\familydefault{\\sfdefault}\\selectfont\n\\color{text-grey}\n';
    case 'iiit-boxed':
      return '\\fontfamily{cmr}\\selectfont\n';
    default:
      return '';
  }
}

function buildAtsHeader(orig) {
  const name = escapeLatex(orig.name || 'Candidate Name');
  const parts = [];
  if (orig.email) parts.push(`\\href{mailto:${escapeLatex(orig.email)}}{${escapeLatex(orig.email)}}`);
  if (orig.phone) parts.push(escapeLatex(String(orig.phone)));
  const gh = normalizeUrl(orig.github);
  const li = normalizeUrl(orig.linkedIn);
  const web = normalizeUrl(orig.website);
  if (gh) parts.push(`\\href{${gh}}{GitHub}`);
  if (li) parts.push(`\\href{${li}}{LinkedIn}`);
  if (web) parts.push(`\\href{${web}}{Portfolio}`);
  const contactLine = parts.join(' $|$ ');
  return `\\begin{center}\n    {\\Huge\\bfseries ${name}} \\\\\n    \\vspace{0.2em}\n    ${contactLine}\n\\end{center}\n`;
}

function buildHarshibarHeader(orig) {
  const name = escapeLatex(orig.name || 'Candidate');
  const items = [];
  if (orig.phone) items.push(`\\faPhone* \\texttt{${escapeLatex(String(orig.phone))}}`);
  if (orig.email) items.push(`\\faEnvelope \\hspace{2pt} \\texttt{${escapeLatex(String(orig.email))}}`);
  const gh = normalizeUrl(orig.github);
  const li = normalizeUrl(orig.linkedIn);
  if (gh) items.push(`\\faGithub \\hspace{2pt} \\texttt{${escapeLatex(gh.replace(/^https?:\/\//, ''))}}`);
  if (li) items.push(`\\faLinkedin \\hspace{2pt} \\texttt{${escapeLatex(li.replace(/^https?:\/\//, ''))}}`);
  if (orig.location) items.push(`\\faMapMarker* \\hspace{2pt}\\texttt{${escapeLatex(String(orig.location))}}`);
  const line = items.join(' \\hspace{1pt} $|$ \\hspace{1pt} ');
  return `    \\textbf{\\Huge ${name}} \\\\ \\vspace{5pt}\n    \\small ${line}\n    \\\\ \\vspace{-3pt}\n`;
}

function buildIiitHeader(orig) {
  const name = escapeLatex(orig.name || 'Candidate');
  const phoneRaw = String(orig.phone || '').trim();
  const phone = phoneRaw.replace(/^\+91[-\s]?/, '');
  const phoneDisplay = phoneRaw.startsWith('+') ? escapeLatex(phoneRaw) : (phone ? `+91-${escapeLatex(phone)}` : '');
  const email = escapeLatex(orig.email || '');
  const emailHref = (orig.email || '').trim();
  const college = getPrimaryCollege(orig.education);
  const degree = escapeLatex(college?.degree || '');
  const institution = escapeLatex(college?.institution || '');
  const gh = normalizeUrl(orig.github);
  const li = normalizeUrl(orig.linkedIn);

  const rows = [];
  rows.push(`  \\textbf{\\Large ${name}} & ${phoneDisplay || ''} \\\\`);
  if (degree || email) {
    rows.push(
      `  ${degree} & ${email ? `\\href{mailto:${escapeLatex(emailHref)}}{${email}}` : ''} \\\\`
    );
  }
  if (institution || gh) {
    rows.push(
      `  ${institution} & ${gh ? `\\href{${gh}}{GitHub}` : ''} \\\\`
    );
  }
  if (li) {
    rows.push(`  & \\href{${li}}{LinkedIn} \\\\`);
  }

  return `\\parbox{\\dimexpr\\linewidth-0.3cm\\relax}{\n\\begin{tabularx}{\\linewidth}{L r}\n${rows.join('\n')}\n\\end{tabularx}\n}\n`;
}

function buildResumeTex(originalData, rewrittenSections, options = {}) {
  const formatId = options.formatId || 'ats-classic';
  const orig = originalData || {};
  const ai = rewrittenSections || {};
  const body = assembleBody(formatId, orig, ai, options);
  const name = escapeLatex(orig.name || 'Candidate Name');

  const fontBootstrap = documentFontBootstrap(formatId);

  if (formatId === 'ats-classic') {
    const preamble = readPreamble('ats-classic.tex');
    return `${preamble}\\begin{document}\n\n${buildAtsHeader(orig)}\n${body}\\end{document}\n`;
  }

  if (formatId === 'harshibar') {
    const preamble = readPreamble('harshibar.tex');
    const summary = ai.summary || orig.summary;
    const summaryBlock = summary
      ? `\\section{SUMMARY}\n${processText(summary, options.highlightKeywords)}\\vspace{6pt}\n`
      : '';
    return `${preamble}\\begin{document}\n${fontBootstrap}\\begin{center}\n${buildHarshibarHeader(orig)}\\end{center}\n${summaryBlock}${body}\\end{document}\n`;
  }

  if (formatId === 'iiit-boxed') {
    const preamble = readPreamble('iiit-boxed.tex');
    return `${preamble}\\begin{document}\n${fontBootstrap}${buildIiitHeader(orig)}${body}\\end{document}\n`;
  }

  if (formatId === 'professional-cv') {
    const phone = escapeLatex(String(orig.phone || ''));
    const email = escapeLatex(String(orig.email || ''));
    const location = escapeLatex(String(orig.location || ''));
    return `\\documentclass{resume}\n\\usepackage[left=0.4in,top=0.3in,right=0.4in,bottom=0.3in]{geometry}\n\\name{${name}}\n\\address{${location}}\n\\address{${phone} \\\\ ${email}}\n\\begin{document}\n${body}\\end{document}\n`;
  }

  throw new Error(`Unknown format: ${formatId}`);
}

module.exports = { buildResumeTex, assembleBody };
