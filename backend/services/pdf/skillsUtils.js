/**
 * Resume skill categories — always prefer the candidate's own section headings
 * (tech or non-tech). Tech buckets are only a fallback when the resume/JD uses
 * generic ATS bucket names and the skill set is clearly technical.
 */

/** Used only when remapping JD-style buckets for clearly technical resumes */
const TECH_SKILL_CATEGORIES = [
  'Languages',
  'Backend',
  'Frontend',
  'Databases',
  'DevOps & Cloud',
  'Tools',
  'Concepts',
];

const JD_STYLE_CATEGORY = /software engineering|data management|professional\s*&\s*domain|cloud\s*&\s*devops\s*tools/i;

/** JD/ATS fluff that must not appear as skill line items */
const INVALID_SKILL_PATTERN =
  /willingness to learn|interest in data|good communication|strong problem-solving|financial services|computer science foundations|proven ability|eager to apply|motivated entry|writing clean|maintainable code standards|domain expertise|value proposition|career goal/i;

function isValidSkillItem(skill) {
  const s = String(skill).trim();
  if (!s || s.length > 42) return false;
  if (INVALID_SKILL_PATTERN.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length > 6) return false;
  return true;
}

function filterSkillList(skills) {
  return dedupeSkills(skills).filter(isValidSkillItem);
}

function isConceptCategoryKey(key) {
  return /^concepts?$/i.test(String(key).trim());
}

function filterConceptSkills(skills) {
  return filterSkillList(skills).filter((s) => {
    const lower = s.toLowerCase();
    if (/\b(oop|dsa|agile|jwt|distributed|event-driven|microservice|solid|tdd|mvc|rest|api)\b/.test(lower)) {
      return true;
    }
    return (
      s.split(/\s+/).length <= 4 &&
      !/\b(service|willingness|communication|financial|foundation|learn|interest|motivat|problem-solving skill)\b/i.test(
        lower
      )
    );
  });
}

function sanitizeCategories(categories) {
  const out = {};
  for (const [key, skills] of Object.entries(categories)) {
    const filtered = isConceptCategoryKey(key)
      ? filterConceptSkills(skills)
      : filterSkillList(skills);
    if (filtered.length) out[key] = filtered;
  }
  return out;
}

function asCategoryObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(
    ([, skills]) => Array.isArray(skills) && skills.length > 0
  );
  return entries.length ? Object.fromEntries(entries) : null;
}

function dedupeSkills(skills) {
  const seen = new Set();
  const out = [];
  for (const skill of skills || []) {
    const key = String(skill).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(skill).trim());
  }
  return out;
}

function flattenCategories(categories) {
  return dedupeSkills(Object.values(categories).flat());
}

/** True when Gemini invented JD-style bucket names instead of resume headings */
function isJdStyleCategories(categories) {
  const keys = Object.keys(categories);
  if (!keys.length) return false;
  return keys.some((k) => JD_STYLE_CATEGORY.test(k));
}

/** Preserve any custom resume/AI headings that are not JD-style buckets */
function shouldPreserveCategoryNames(categories) {
  const keys = Object.keys(categories);
  if (!keys.length) return false;
  return !isJdStyleCategories(categories);
}

function bucketSkill(skill) {
  const s = String(skill).toLowerCase();
  if (!isValidSkillItem(skill)) return null;
  if (/\b(java|python|c\+\+|c#|javascript|typescript|go\b|rust|kotlin|scala|ruby|php)\b/.test(s)) {
    return 'Languages';
  }
  if (/\b(react|angular|vue|next\.js|html|css|tailwind|frontend)\b/.test(s)) {
    return 'Frontend';
  }
  if (/\b(mysql|postgres|mongodb|firebase|supabase|cassandra|couchbase|elasticsearch|nosql|sql|database|dbms)\b/.test(s)) {
    return 'Databases';
  }
  if (/\b(docker|kubernetes|openshift|aws|gcp|azure|jenkins|ci\/cd|devops|cloud|gradle|maven)\b/.test(s)) {
    return 'DevOps & Cloud';
  }
  if (/\b(spring|hibernate|rest|microservice|flask|django|express|node\.js|vert\.?x|api gateway)\b/.test(s)) {
    return 'Backend';
  }
  if (/\b(git|kafka|dynatrace|swagger|junit|intellij|vscode|bitbucket|openapi|mockito)\b/.test(s)) {
    return 'Tools';
  }
  if (/\b(agile|oop|dsa|jwt|machine learning|distributed|event-driven|design principles)\b/.test(s)) {
    return 'Concepts';
  }
  if (/\b(problem-solving|clean code|communication)\b/.test(s)) {
    return null;
  }
  return null;
}

function isLikelyTechSkillSet(skills) {
  const flat = dedupeSkills(skills).filter(isValidSkillItem);
  if (!flat.length) return false;
  let techCount = 0;
  for (const s of flat) {
    const bucket = bucketSkill(s);
    if (bucket) techCount++;
  }
  return techCount / flat.length >= 0.2;
}

function remapToTechCategories(categories) {
  const buckets = Object.fromEntries(TECH_SKILL_CATEGORIES.map((k) => [k, []]));
  for (const skill of flattenCategories(categories)) {
    const bucket = bucketSkill(skill);
    if (bucket) buckets[bucket].push(skill);
    else buckets.Tools.push(skill);
  }
  return Object.fromEntries(
    Object.entries(buckets)
      .map(([k, v]) => [k, dedupeSkills(v)])
      .filter(([, v]) => v.length)
  );
}

function splitFlatSkillsGeneric(skills) {
  const valid = filterSkillList(dedupeSkills(skills));
  if (!valid.length) return {};
  if (valid.length <= 10) return { Skills: valid };
  const mid = Math.ceil(valid.length / 2);
  return {
    'Core Skills': valid.slice(0, mid),
    'Additional Skills': valid.slice(mid),
  };
}

function splitFlatSkills(skills) {
  const valid = dedupeSkills(skills);
  if (!valid.length) return {};
  if (isLikelyTechSkillSet(valid)) {
    return remapToTechCategories({ all: valid });
  }
  return splitFlatSkillsGeneric(valid);
}

function getOrigCategoriesResolved(orig = {}) {
  const cats = asCategoryObject(orig.skillCategories);
  if (cats) return sanitizeCategories(cats);
  const flat = Array.isArray(orig.skills) ? orig.skills : [];
  if (flat.length) return sanitizeCategories(splitFlatSkills(flat));
  return {};
}

function findCategoryKey(keys, target) {
  const t = String(target).toLowerCase();
  return keys.find((k) => k.toLowerCase() === t);
}

function matchBucketToCategoryKey(bucket, categoryKeys) {
  if (!bucket) return null;
  const direct = findCategoryKey(categoryKeys, bucket);
  if (direct) return direct;
  const hints = {
    Languages: /language/i,
    Backend: /back|framework|api/i,
    Frontend: /front|ui/i,
    Databases: /database|data store|db/i,
    'DevOps & Cloud': /devops|cloud|infra/i,
    Tools: /tool/i,
    Concepts: /concept|method/i,
  };
  const hint = hints[bucket];
  if (hint) {
    const match = categoryKeys.find((k) => hint.test(k));
    if (match) return match;
  }
  return categoryKeys.find((k) => /tool|skill/i.test(k)) || categoryKeys[categoryKeys.length - 1] || null;
}

function isCollapsedAiCategories(aiKeys) {
  return aiKeys.length === 1 && /^skills?$/i.test(String(aiKeys[0]).trim());
}

function distributeSkillsIntoCategories(flatSkills, categoryKeys) {
  if (!categoryKeys.length) return {};
  const out = Object.fromEntries(categoryKeys.map((k) => [k, []]));
  for (const skill of filterSkillList(flatSkills)) {
    const bucket = bucketSkill(skill);
    const key = matchBucketToCategoryKey(bucket, categoryKeys) || categoryKeys[0];
    out[key].push(skill);
  }
  return Object.fromEntries(
    Object.entries(out)
      .map(([k, v]) => [k, dedupeSkills(v)])
      .filter(([, v]) => v.length)
  );
}

/** Union tailored skills with original — never drop resume skills */
function mergeSkillCategories(orig = {}, ai = {}) {
  const origCats = getOrigCategoriesResolved(orig);
  const aiCats = asCategoryObject(ai?.skillCategories || ai) || {};

  if (!Object.keys(aiCats).length) return origCats;
  if (!Object.keys(origCats).length) {
    return resolveSkillCategories({}, { skillCategories: aiCats });
  }

  const origKeys = Object.keys(origCats);
  const aiKeys = Object.keys(aiCats);

  // AI collapsed everything into a single "Skills" key — restore resume structure
  if (isCollapsedAiCategories(aiKeys) && origKeys.length > 1) {
    const combined = dedupeSkills([
      ...flattenCategories(aiCats),
      ...flattenCategories(origCats),
    ]);
    const distributed = distributeSkillsIntoCategories(combined, origKeys);
    const out = { ...origCats };
    for (const key of origKeys) {
      out[key] = dedupeSkills([...(distributed[key] || []), ...origCats[key]]);
    }
    return sanitizeCategories(out);
  }

  // JD-style or structured AI keys mapped into resume headings
  if (isJdStyleCategories(aiCats) || origKeys.length > 0) {
    const normalizedAi = shouldPreserveCategoryNames(aiCats)
      ? Object.fromEntries(Object.entries(aiCats).map(([k, v]) => [k, dedupeSkills(v)]))
      : isLikelyTechSkillSet(flattenCategories(aiCats))
        ? remapToTechCategories(aiCats)
        : splitFlatSkillsGeneric(flattenCategories(aiCats));
    const mapped = normalizeAiIntoResumeKeys(origCats, normalizedAi);
    const out = { ...origCats };
    for (const key of new Set([...origKeys, ...Object.keys(mapped)])) {
      out[key] = dedupeSkills([...(mapped[key] || []), ...(origCats[key] || [])]);
    }
    return sanitizeCategories(out);
  }

  // Per-category union: AI additions first, then any original skills not yet listed
  const out = { ...origCats };
  for (const [aiKey, aiSkills] of Object.entries(aiCats)) {
    const matchKey = findCategoryKey(origKeys, aiKey) || aiKey;
    const existing = out[matchKey] || [];
    const aiList = filterSkillList(aiSkills);
    const origOnly = existing.filter(
      (s) => !aiList.some((a) => a.toLowerCase() === s.toLowerCase())
    );
    out[matchKey] = dedupeSkills([...aiList, ...origOnly]);
  }
  for (const key of origKeys) {
    out[key] = dedupeSkills([...(out[key] || []), ...origCats[key]]);
  }
  return sanitizeCategories(out);
}

function normalizeAiIntoResumeKeys(origCats, aiCats) {
  const normalizedAi = shouldPreserveCategoryNames(aiCats)
    ? Object.fromEntries(Object.entries(aiCats).map(([k, v]) => [k, dedupeSkills(v)]))
    : isLikelyTechSkillSet(flattenCategories(aiCats))
      ? remapToTechCategories(aiCats)
      : splitFlatSkillsGeneric(flattenCategories(aiCats));

  const out = {};
  for (const key of Object.keys(origCats)) {
    const matchKey = Object.keys(normalizedAi).find(
      (k) => k.toLowerCase() === key.toLowerCase()
    );
    out[key] = dedupeSkills(normalizedAi[matchKey || key] || origCats[key]);
  }
  return out;
}

/**
 * Pick skill categories for PDF rendering.
 * 1. Resume headings win (any industry)
 * 2. Custom AI headings preserved when not JD-style
 * 3. JD-style buckets → tech remap only for technical skill sets; else generic Skills
 */
function resolveSkillCategories(orig = {}, ai = {}) {
  const origCats = asCategoryObject(orig.skillCategories);
  const aiCats = asCategoryObject(ai.skillCategories);

  if (origCats && aiCats) {
    return mergeSkillCategories(orig, { skillCategories: aiCats });
  }

  if (origCats && !aiCats) {
    return sanitizeCategories(origCats);
  }

  if (aiCats) {
    if (shouldPreserveCategoryNames(aiCats)) {
      return sanitizeCategories(
        Object.fromEntries(Object.entries(aiCats).map(([k, v]) => [k, dedupeSkills(v)]))
      );
    }
    const flat = flattenCategories(aiCats);
    if (isLikelyTechSkillSet(flat)) {
      return sanitizeCategories(remapToTechCategories(aiCats));
    }
    return sanitizeCategories(splitFlatSkillsGeneric(flat));
  }

  const flat = Array.isArray(orig.skills) ? orig.skills : [];
  if (flat.length) return sanitizeCategories(splitFlatSkills(flat));

  return {};
}

function cleanExperienceBullet(text) {
  return String(text)
    .replace(/\s*\([A-Za-z]+\s+\d{4}\s*[–-]\s*(?:Present|[A-Za-z]+\s+\d{4})\)\s*\.?\s*$/i, '')
    .trim();
}

// Back-compat alias
const STANDARD_SKILL_CATEGORIES = TECH_SKILL_CATEGORIES;

module.exports = {
  STANDARD_SKILL_CATEGORIES,
  TECH_SKILL_CATEGORIES,
  resolveSkillCategories,
  mergeSkillCategories,
  getOrigCategoriesResolved,
  cleanExperienceBullet,
  dedupeSkills,
  isValidSkillItem,
  filterSkillList,
  shouldPreserveCategoryNames,
  isLikelyTechSkillSet,
};
