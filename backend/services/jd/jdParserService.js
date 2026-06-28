const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

async function extractWithGemini(buffer, mimeType, hint) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required to parse this file format.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
  const base64 = buffer.toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
    {
      text:
        `${hint}\n\n` +
        'Return ONLY the extracted job description text. No markdown, no commentary. ' +
        'Preserve headings, bullet points, and requirements as plain text.',
    },
  ]);

  const text = result.response?.text?.()?.trim();
  if (!text || text.length < 30) {
    throw new Error('Could not extract enough text from the uploaded file.');
  }
  return text;
}

async function extractFromDocx(buffer) {
  try {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    if (value && value.trim().length >= 30) return value.trim();
  } catch (err) {
    console.warn('mammoth DOCX parse failed, falling back to Gemini:', err.message);
  }
  return extractWithGemini(buffer, DOCX_MIME, 'Extract the full job description from this Word document.');
}

/**
 * Extract plain-text job description from an uploaded JD file.
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 */
async function extractJdText(file) {
  const { buffer, mimetype, originalname } = file;
  const ext = path.extname(originalname || '').toLowerCase();

  if (mimetype === 'text/plain' || ext === '.txt') {
    const text = buffer.toString('utf8').trim();
    if (text.length < 30) throw new Error('Text file appears empty or too short.');
    return text;
  }

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    const pdfData = await pdfParse(buffer);
    const text = (pdfData.text || '').trim();
    if (text.length < 30) {
      return extractWithGemini(buffer, 'application/pdf', 'Extract the full job description from this PDF.');
    }
    return text;
  }

  if (mimetype === DOCX_MIME || ext === '.docx') {
    return extractFromDocx(buffer);
  }

  if (mimetype === DOC_MIME || ext === '.doc') {
    return extractWithGemini(buffer, DOC_MIME, 'Extract the full job description from this Word document.');
  }

  if (IMAGE_MIMES.has(mimetype) || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
    const imageMime = IMAGE_MIMES.has(mimetype) ? mimetype : 'image/jpeg';
    return extractWithGemini(buffer, imageMime, 'Extract all job description text visible in this image.');
  }

  throw new Error('Unsupported file type for job description parsing.');
}

module.exports = { extractJdText };
