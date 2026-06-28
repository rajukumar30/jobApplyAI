const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSkillCategories, cleanExperienceBullet, mergeSkillCategories } = require('../services/pdf/skillsUtils');
const { buildResumeTex } = require('../services/pdf/formatBuilders');

test('resolveSkillCategories preserves resume category names over JD-style AI buckets', () => {
  const orig = {
    skillCategories: {
      Languages: ['Java', 'Python'],
      Backend: ['Spring Boot'],
      Frontend: ['React.js'],
      Databases: ['PostgreSQL'],
      'DevOps & Cloud': ['Docker'],
      Tools: ['Git'],
      Concepts: ['OOP'],
    },
  };
  const ai = {
    skillCategories: {
      'Software Engineering & Architecture': ['Java', 'Microservices', 'REST APIs'],
      'Data Management & Databases': ['Kafka', 'PostgreSQL'],
      'Cloud & DevOps Tools': ['Docker', 'Kubernetes'],
    },
  };
  const out = resolveSkillCategories(orig, ai);
  assert.ok(out.Languages?.includes('Java'));
  assert.ok(out.Backend?.includes('Microservices') || out.Backend?.includes('REST APIs'));
  assert.ok(out['DevOps & Cloud']?.includes('Kubernetes'));
  assert.equal(Object.keys(out).some((k) => /software engineering/i.test(k)), false);
});

test('resolveSkillCategories remaps JD-style categories when resume has none', () => {
  const ai = {
    skillCategories: {
      'Software Engineering & Architecture': ['Java', 'Spring Boot', 'REST APIs'],
      'Cloud & DevOps Tools': ['Docker', 'Kubernetes'],
    },
  };
  const out = resolveSkillCategories({}, ai);
  assert.ok(out.Languages?.includes('Java') || out.Backend?.includes('Java'));
  assert.ok(out['DevOps & Cloud']?.includes('Docker'));
  assert.equal(Object.keys(out).some((k) => /software engineering/i.test(k)), false);
});

test('cleanExperienceBullet strips trailing date parentheses', () => {
  const bullet = 'Built APIs using Java. (July 2025 – Present)';
  assert.equal(cleanExperienceBullet(bullet), 'Built APIs using Java.');
});

test('IIIT projects put tech stack in bullet not project subtitle', () => {
  const tex = buildResumeTex(
    {
      name: 'Test',
      projects: [{
        name: 'TrackWise',
        technologies: ['Java 17', 'Spring Boot', 'Kafka'],
        description: 'Microservices tracking platform',
      }],
    },
    { projects: [{ bullets: ['Designed 5 microservices.', 'Built REST APIs.'] }] },
    { formatId: 'iiit-boxed' }
  );
  assert.match(tex, /Tools \\& technologies used: Java 17, Spring Boot, Kafka/);
  assert.match(tex, /\\resumeProject\n      \{TrackWise\}\n      \{Microservices tracking platform\}/);
  assert.doesNotMatch(tex, /\\resumeProject\n      \{TrackWise\}\n      \{Java 17/);
});

test('resolveSkillCategories preserves non-tech resume headings', () => {
  const orig = {
    skillCategories: {
      'Digital Marketing': ['SEO', 'Google Ads', 'Meta Ads'],
      Content: ['Copywriting', 'Blogging'],
      Analytics: ['Google Analytics', 'Tableau'],
    },
  };
  const ai = {
    skillCategories: {
      'Software Engineering & Architecture': ['SEO', 'Google Ads'],
      'Data Management & Databases': ['Tableau'],
    },
  };
  const out = resolveSkillCategories(orig, ai);
  assert.ok(out['Digital Marketing']?.includes('SEO'));
  assert.ok(out.Analytics?.includes('Tableau'));
  assert.equal(out.Languages, undefined);
  assert.equal(out.Backend, undefined);
});

test('resolveSkillCategories uses generic Skills for non-tech flat list', () => {
  const out = resolveSkillCategories(
    { skills: ['Patient Care', 'HIPAA Compliance', 'EHR Documentation', 'Vital Signs'] },
    {}
  );
  assert.ok(out.Skills?.includes('Patient Care') || out['Core Skills']?.includes('Patient Care'));
  assert.equal(out.Languages, undefined);
});

test('resolveSkillCategories strips JD fluff from Concepts', () => {
  const ai = {
    skillCategories: {
      Languages: ['Java', 'Python'],
      Concepts: [
        'OOP',
        'DSA',
        'Financial Services',
        'Willingness to Learn New Technologies',
        'Strong Problem-Solving Skills',
      ],
    },
  };
  const out = resolveSkillCategories({}, ai);
  assert.ok(out.Concepts?.includes('OOP'));
  assert.ok(out.Concepts?.includes('DSA'));
  assert.equal(out.Concepts?.some((s) => /financial services/i.test(s)), false);
  assert.equal(out.Concepts?.some((s) => /willingness/i.test(s)), false);
});

test('mergeSkillCategories restores full resume structure when AI collapses to Skills', () => {
  const orig = {
    skillCategories: {
      Languages: ['Java', 'Python'],
      Backend: ['Spring Boot', 'REST APIs', 'Microservices'],
      Frontend: ['React.js', 'Next.js'],
      Databases: ['PostgreSQL', 'MySQL', 'Firebase'],
      'DevOps & Cloud': ['Docker', 'Kubernetes', 'AWS'],
      Tools: ['Git', 'Kafka', 'Maven'],
      Concepts: ['OOP', 'DSA'],
    },
  };
  const ai = {
    skillCategories: {
      Skills: ['Java', 'Spring Boot', 'Microservices', 'Kafka', 'Docker'],
    },
  };
  const out = mergeSkillCategories(orig, ai);
  assert.ok(out.Languages?.includes('Java'));
  assert.ok(out.Languages?.includes('Python'));
  assert.ok(out.Backend?.includes('Spring Boot'));
  assert.ok(out.Frontend?.includes('React.js'));
  assert.ok(out.Databases?.includes('PostgreSQL'));
  assert.equal(out.Skills, undefined);
  assert.ok(Object.keys(out).length >= 6);
});

test('ats-classic projects put tech stack in first bullet', () => {
  const tex = buildResumeTex(
    {
      name: 'Test',
      projects: [{
        name: 'TrackWise',
        technologies: ['Java', 'Spring Boot'],
      }],
    },
    { projects: [{ bullets: ['Built microservices.'] }] },
    { formatId: 'ats-classic' }
  );
  assert.match(tex, /Tools \\& technologies used: Java, Spring Boot/);
  assert.doesNotMatch(tex, /\\textit\{Java, Spring Boot\}/);
});

test('IIIT skills LaTeX lines are properly closed', () => {
  const tex = buildResumeTex(
    { name: 'Test' },
    { skillCategories: { Languages: ['Java'], Backend: ['Spring Boot'] } },
    { formatId: 'iiit-boxed' }
  );
  assert.match(tex, /\\textbf\{Languages\}\{: Java\} \\\\/);
  assert.doesNotMatch(tex, /\\textbf\{Languages\}\{: Java \\\\/);
});
