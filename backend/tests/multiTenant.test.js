const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { fillLatexTemplate } = require('../services/pdf/latexService');
const { getUserJsonPath, writeUserJson, readUserJson } = require('../services/userStorage');

test('LaTeX resume identity comes from the selected user resume', () => {
  const output = fillLatexTemplate({
    name: 'Alex Morgan',
    email: 'alex@example.com',
    phone: '5551234567',
    location: 'Austin, TX',
    linkedIn: 'linkedin.com/in/alex-morgan',
    github: 'github.com/alex-morgan',
    experience: [{
      role: 'Data Analyst',
      company: 'Example Labs',
      startDate: 'January 2024',
      endDate: 'Present',
    }],
    education: [{
      degree: 'BSc Computer Science',
      institution: 'Example University',
      graduationYear: '2023',
    }],
    certifications: ['Analytics Certificate'],
    projects: [],
  }, {
    summary: 'Candidate-specific summary.',
    skillCategories: { Analytics: ['SQL'] },
    experienceBullets: ['Improved reporting accuracy by 20%.'],
    projects: [],
  });

  assert.match(output, /Alex Morgan/);
  assert.match(output, /alex@example\.com/);
  assert.match(output, /Example Labs/);
  assert.doesNotMatch(output, /NIKITA SHARMA/i);
  assert.doesNotMatch(output, /nikita\.sharma/i);
});

test('local metadata stores are isolated by Firebase UID', () => {
  const userA = `test_user_a_${Date.now()}`;
  const userB = `test_user_b_${Date.now()}`;
  writeUserJson(userA, 'resumeStore.json', [{ filename: 'a.pdf' }]);
  writeUserJson(userB, 'resumeStore.json', [{ filename: 'b.pdf' }]);

  assert.deepEqual(readUserJson(userA, 'resumeStore.json', []), [{ filename: 'a.pdf' }]);
  assert.deepEqual(readUserJson(userB, 'resumeStore.json', []), [{ filename: 'b.pdf' }]);

  fs.rmSync(path.dirname(getUserJsonPath(userA, 'resumeStore.json')), { recursive: true, force: true });
  fs.rmSync(path.dirname(getUserJsonPath(userB, 'resumeStore.json')), { recursive: true, force: true });
});
