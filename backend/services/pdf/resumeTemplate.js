// Fixed pdfmake resume template — mirrors the LaTeX template exactly.
// Layout, styles, section order, and spacing are LOCKED.
// Only 4 sections accept AI-rewritten content: summary, skills, experience bullets, project descriptions.

const STYLES = {
  header: {
    fontSize: 24,
    bold: true,
    alignment: 'center',
    margin: [0, 0, 0, 5],
    color: '#003366'
  },
  contact: {
    fontSize: 10,
    alignment: 'center',
    margin: [0, 0, 0, 10],
    color: '#333333'
  },
  sectionHeader: {
    fontSize: 14,
    bold: true,
    margin: [0, 10, 0, 5],
    color: '#003366',
    background: '#F0F0F0'
  },
  jobTitle: {
    fontSize: 11,
    bold: true,
    margin: [0, 0, 0, 2]
  },
  company: {
    fontSize: 10,
    italics: true,
    margin: [0, 0, 0, 5],
    color: '#555555'
  },
  body: {
    fontSize: 10,
    margin: [0, 0, 0, 5]
  },
  link: {
    color: '#0000FF',
    fontSize: 10
  }
};

function buildContactLine(data) {
  const parts = [];
  if (data.location) parts.push(data.location);
  if (data.phone) parts.push(data.phone);
  if (data.email) parts.push(data.email);

  const textParts = [];
  parts.forEach((p, i) => {
    if (i > 0) textParts.push(' | ');
    textParts.push(p);
  });

  if (data.linkedIn) {
    if (textParts.length > 0) textParts.push(' | ');
    textParts.push({
      text: data.linkedIn.replace(/^https?:\/\//, ''),
      link: data.linkedIn.startsWith('http') ? data.linkedIn : `https://${data.linkedIn}`,
      style: 'link'
    });
  }
  if (data.github) {
    if (textParts.length > 0) textParts.push(' | ');
    textParts.push({
      text: data.github.replace(/^https?:\/\//, ''),
      link: data.github.startsWith('http') ? data.github : `https://${data.github}`,
      style: 'link'
    });
  }

  return textParts;
}

function groupSkills(skills) {
  if (!skills || skills.length === 0) return [];

  const colSize = Math.ceil(skills.length / 3);
  const col1 = skills.slice(0, colSize);
  const col2 = skills.slice(colSize, colSize * 2);
  const col3 = skills.slice(colSize * 2);

  const columns = [];
  if (col1.length > 0) columns.push({ stack: [{ ul: col1 }] });
  if (col2.length > 0) columns.push({ stack: [{ ul: col2 }] });
  if (col3.length > 0) columns.push({ stack: [{ ul: col3 }] });

  return columns;
}

// originalData = the selected resume's parsedData (all fields)
// rewrittenSections = ONLY the 4 AI-rewritten sections {summary, skills, experience, projects}
function buildResumeDocument(originalData, rewrittenSections) {
  const orig = originalData || {};
  const ai = rewrittenSections || {};
  const content = [];

  // ══════════════════════════════════════════════════════════════════════
  // LOCKED — Name and contact info (AI never touches)
  // ══════════════════════════════════════════════════════════════════════
  content.push({
    text: orig.name || 'Candidate Name',
    style: 'header'
  });

  const contactParts = buildContactLine(orig);
  if (contactParts.length > 0) {
    content.push({ text: contactParts, style: 'contact' });
  }

  // ══════════════════════════════════════════════════════════════════════
  // EDITABLE — Professional Summary (AI rewrites content)
  // ══════════════════════════════════════════════════════════════════════
  content.push({ text: 'PROFESSIONAL SUMMARY', style: 'sectionHeader' });
  content.push({
    text: ai.summary || orig.summary || '',
    style: 'body'
  });

  // ══════════════════════════════════════════════════════════════════════
  // EDITABLE — Technical Skills (AI reorders/adjusts)
  // ══════════════════════════════════════════════════════════════════════
  content.push({ text: 'TECHNICAL SKILLS', style: 'sectionHeader' });
  const skills = ai.skills || orig.skills || [];
  const skillColumns = groupSkills(skills);
  if (skillColumns.length > 0) {
    content.push({ columns: skillColumns, style: 'body' });
  }

  // ══════════════════════════════════════════════════════════════════════
  // EDITABLE — Professional Experience (AI rewrites bullets ONLY)
  // Role, company, location, dates are LOCKED from original.
  // ══════════════════════════════════════════════════════════════════════
  content.push({ text: 'PROFESSIONAL EXPERIENCE', style: 'sectionHeader' });
  const originalExp = orig.experience || [];
  const aiExp = ai.experience || [];
  for (let i = 0; i < originalExp.length; i++) {
    const exp = originalExp[i];
    content.push({ text: exp.role || 'Role', style: 'jobTitle' });

    const companyParts = [exp.company || ''];
    if (exp.location) companyParts.push(exp.location);
    if (exp.duration || exp.startDate) {
      const dateStr = exp.duration || `${exp.startDate || ''} - ${exp.endDate || 'Present'}`;
      companyParts.push(dateStr);
    }
    content.push({ text: companyParts.join(' | '), style: 'company' });

    const bullets = aiExp[i]?.achievements || exp.achievements || [];
    if (bullets.length > 0) {
      content.push({ ul: bullets, style: 'body' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // EDITABLE — Projects (AI rewrites descriptions ONLY)
  // Project names are LOCKED from original.
  // ══════════════════════════════════════════════════════════════════════
  const originalProj = orig.projects || [];
  const aiProj = ai.projects || [];
  if (originalProj.length > 0) {
    content.push({ text: 'PROJECTS', style: 'sectionHeader' });
    for (let i = 0; i < originalProj.length; i++) {
      content.push({ text: originalProj[i].name || 'Project', style: 'jobTitle' });
      const desc = aiProj[i]?.description || originalProj[i].description || '';
      if (desc) {
        content.push({ text: desc, style: 'body' });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // LOCKED — Education (AI never touches)
  // ══════════════════════════════════════════════════════════════════════
  const education = orig.education || [];
  if (education.length > 0) {
    content.push({ text: 'EDUCATION', style: 'sectionHeader' });
    for (const edu of education) {
      content.push({
        columns: [
          { text: edu.degree || 'Degree', style: 'jobTitle' },
          { text: edu.graduationYear || edu.year || '', alignment: 'right', style: 'body' }
        ]
      });
      if (edu.institution) {
        content.push({ text: edu.institution, style: 'company' });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // LOCKED — Certifications (AI never touches)
  // ══════════════════════════════════════════════════════════════════════
  const certs = orig.certifications || [];
  if (certs.length > 0) {
    content.push({ text: 'CERTIFICATIONS', style: 'sectionHeader' });
    content.push({ ul: certs, style: 'body' });
  }

  return {
    content,
    styles: { ...STYLES },
    defaultStyle: { font: 'Helvetica' },
    pageMargins: [40, 30, 40, 30]
  };
}

module.exports = { buildResumeDocument };
