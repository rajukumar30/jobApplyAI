require('dotenv').config({ path: './.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    const models = await genAI.getModels();
    console.log("Available models:");
    for (const model of models) {
      console.log(model.name);
    }
  } catch (e) {
    console.error(e.message);
  }
}
run();
