/**
 * Classify and filter education entries for resume rendering.
 * Omits Class 10 / Class 12 blocks when not present in parsed resume data.
 */

function classifyEducationLevel(edu) {
  if (!edu) return 'college';
  const text = `${edu.degree || ''} ${edu.institution || ''} ${edu.board || ''}`.toLowerCase();

  if (/\b(10th|class\s*x\b|ssc\b|matriculation|secondary\s+school|board\s+of\s+secondary)\b/.test(text)) {
    return 'class10';
  }
  if (/\b(12th|class\s*xii|hsc\b|intermediate|senior\s+secondary|higher\s+secondary|board\s+of\s+intermediate)\b/.test(text)) {
    return 'class12';
  }
  return 'college';
}

function splitEducation(education) {
  const list = Array.isArray(education) ? education : [];
  const result = { college: [], class10: [], class12: [] };

  for (const edu of list) {
    const level = edu.level || classifyEducationLevel(edu);
    if (level === 'class10') result.class10.push(edu);
    else if (level === 'class12') result.class12.push(edu);
    else result.college.push(edu);
  }

  return result;
}

function getPrimaryCollege(education) {
  const { college } = splitEducation(education);
  return college[0] || null;
}

function shouldPlaceEducationAtTop(tierInfo) {
  if (!tierInfo) return true;
  if (typeof tierInfo.placeEducationAtTop === 'boolean') return tierInfo.placeEducationAtTop;
  const tier = Number(tierInfo.tier);
  return tier === 1 || tier === 2;
}

/**
 * Section order keys used by format builders.
 * educationPosition: 'top' | 'bottom'
 */
function getSectionOrder(formatId, educationPosition) {
  const top = educationPosition === 'top';

  switch (formatId) {
    case 'harshibar':
      return top
        ? ['summary', 'experience', 'education', 'projects', 'skills', 'coursework', 'certifications']
        : ['summary', 'experience', 'projects', 'skills', 'education', 'coursework', 'certifications'];

    case 'iiit-boxed':
    case 'professional-cv':
      return top
        ? ['summary', 'education', 'skills', 'experience', 'projects', 'coursework', 'certifications']
        : ['summary', 'skills', 'experience', 'projects', 'education', 'coursework', 'certifications'];

    case 'ats-classic':
    default:
      return top
        ? ['summary', 'education', 'skills', 'experience', 'projects', 'coursework', 'certifications']
        : ['summary', 'skills', 'experience', 'projects', 'education', 'coursework', 'certifications'];
  }
}

module.exports = {
  classifyEducationLevel,
  splitEducation,
  getPrimaryCollege,
  shouldPlaceEducationAtTop,
  getSectionOrder,
};
