require('dotenv').config();
const geminiService = require('./backend/services/gemini/geminiService');

async function test() {
  console.log('Testing geminiService.analyzeJob...');
  try {
    const res = await geminiService.analyzeJob('We are looking for a software engineer with 3 years of React experience. Contact us at jobs@example.com');
    console.log('Result:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
