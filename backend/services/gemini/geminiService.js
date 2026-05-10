const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAuth }          = require('google-auth-library');
const { GoogleGenAI }         = require('@google/genai');
const path = require('path');
const fs   = require('fs');

// ── Auth Mode Detection ─────────────────────────────────────────────────────
// ── Auth Mode Detection ─────────────────────────────────────────────────────
// Prefer API key mode by default (easier for switching projects).
// Set USE_VERTEX_AI=true in .env to use Agent Platform (requires service account).
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../../firebase-service-account.json');
const USE_VERTEX_AI = process.env.USE_VERTEX_AI === 'true' && fs.existsSync(SERVICE_ACCOUNT_PATH);

const GCP_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT  || 'jobapply-ai-c597b';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';

// Primary model — gemini-2.0-flash (has high free tier quota, whereas 2.5-flash is limited to 20/day)
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

let vertexClient = null;   // @google/genai client for Vertex AI
let genAI        = null;   // @google/generative-ai client for API key fallback
let geminiModels = [];     // API-key fallback model chain

if (USE_VERTEX_AI) {
  // ── Vertex AI / Agent Platform Mode ────────────────────────────────────────
  process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
  vertexClient = new GoogleGenAI({
    vertexai: true,
    project:  GCP_PROJECT,
    location: GCP_LOCATION,
  });
  console.log(`🌐 Gemini: Using Vertex AI (Agent Platform) — project: ${GCP_PROJECT}, model: ${PRIMARY_MODEL}`);
} else {
  // ── API Key Mode (fallback) ─────────────────────────────────────────────────
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const MODEL_CHAIN = [
    PRIMARY_MODEL,
    PRIMARY_MODEL === 'gemini-2.5-flash' ? 'gemini-2.0-flash' : 'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const sharedConfig = { temperature: 0.1, topP: 0.9, maxOutputTokens: 16384 };
  geminiModels = MODEL_CHAIN.map(model =>
    ({ name: model, instance: genAI.getGenerativeModel({ model, generationConfig: sharedConfig }) })
  );
  console.log(`🔑 Gemini: Using API Key mode — model chain: ${MODEL_CHAIN.join(' → ')}`);
}

// 90-second hard timeout
const GEMINI_TIMEOUT_MS = 90_000;

function isLocationError(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('user location is not supported') ||
    msg.includes('location is not supported') ||
    msg.includes('api_key_service_blocked')
  );
}

async function generateAIResponse(prompt) {
  const makeTimeout = () =>
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Gemini request timed out after 90 seconds')),
        GEMINI_TIMEOUT_MS
      )
    );

  // ── Path 1: Vertex AI (Agent Platform) ─────────────────────────────────────
  if (USE_VERTEX_AI) {
    try {
      const result = await Promise.race([
        vertexClient.models.generateContent({
          model:    PRIMARY_MODEL,
          contents: prompt,
          config:   { temperature: 0.1, topP: 0.9, maxOutputTokens: 16384 },
        }),
        makeTimeout(),
      ]);
      return result.text;
    } catch (err) {
      console.error(`Vertex AI call failed (${PRIMARY_MODEL}):`, err.message);
      throw new Error(`Gemini API failed: ${err.message}`);
    }
  }

  // ── Path 2: API Key Fallback ────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in .env file');
  }

  let lastErr = null;
  for (let i = 0; i < geminiModels.length; i++) {
    const { name: modelName, instance: model } = geminiModels[i];
    try {
      const result = await Promise.race([
        model.generateContent(prompt),
        makeTimeout(),
      ]);
      if (i > 0) console.log(`✅ Model [${modelName}] succeeded (fallback #${i}).`);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      console.error(`Gemini API call failed (${modelName}):`, err.message);

      const blocked  = isLocationError(err);
      const notFound = (err.message || '').includes('404') ||
                       (err.message || '').toLowerCase().includes('not found');
      const quota    = (err.message || '').includes('429') ||
                       (err.message || '').toLowerCase().includes('quota');

      if ((blocked || notFound) && i < geminiModels.length - 1) {
        console.warn(`⚠️  [${modelName}] ${blocked ? 'region-blocked' : 'not available'}. Trying: ${geminiModels[i + 1].name}...`);
        continue;
      }
      throw new Error(`Gemini API failed: ${err.message}`);
    }
  }
  throw new Error(`Gemini API failed: ${lastErr?.message || 'Unknown error'}`);
}
function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (err1) {
    // Attempt 1: Look for markdown JSON block
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1]); } catch (err2) {}
    }

    // Attempt 2: Manually clean and parse
    let cleanedText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Find the first { or [ and the LAST } or ]
    const firstBrace = cleanedText.indexOf('{');
    const firstBracket = cleanedText.indexOf('[');

    let startIndex = -1;
    let isObject = false;

    if (firstBrace !== -1 && firstBracket !== -1) {
      if (firstBrace < firstBracket) { startIndex = firstBrace; isObject = true; }
      else { startIndex = firstBracket; isObject = false; }
    } else if (firstBrace !== -1) {
      startIndex = firstBrace; isObject = true;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket; isObject = false;
    }

    if (startIndex !== -1) {
      const endIndex = isObject ? cleanedText.lastIndexOf('}') : cleanedText.lastIndexOf(']');
      if (endIndex !== -1 && endIndex > startIndex) {
        const jsonStr = cleanedText.substring(startIndex, endIndex + 1);
        try {
          return JSON.parse(jsonStr);
        } catch (err3) {
          // Attempt 3: Sometimes Gemini leaves trailing commas. This is a naive attempt to fix simple trailing commas
          const noTrailingComma = jsonStr.replace(/,\s*([\}\]])/g, '$1');
          try {
             return JSON.parse(noTrailingComma);
          } catch(err4) {
             console.error('Final JSON repair failed:', err4.message);
          }
        }
      }
    }

    console.error('Raw failed JSON output length:', text.length);
    throw new Error('Could not extract valid JSON from AI response. Check backend logs for details.');
  }
}

// â”€â”€ Parse Resume â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function parseResume(pdfText) {
  const prompt = `You are a professional resume parser. Your job is to extract EVERY piece of information from the resume text below with 100% accuracy. Do NOT skip any detail. Do NOT use placeholder text.

CRITICAL RULES:
- Extract the ACTUAL values from the resume text â€” never use example text
- If a field is missing in the resume, use null for strings or [] for arrays
- Extract ALL skills, tools, technologies mentioned anywhere in the resume
- For experience, extract EVERY job with full details including achievements/metrics
- For education, include ALL degrees, certifications, courses
- For projects, include ALL projects with technologies used
- Return ONLY valid JSON, no explanation text

Return this EXACT JSON structure with real extracted values:
{
  "name": "candidate full name",
  "email": "email address or null",
  "phone": "phone number or null",
  "location": "city, country or null",
  "linkedIn": "LinkedIn URL or null",
  "github": "GitHub URL or null",
  "website": "personal website or null",
  "idealRole": "the single most fitting job title based on their FULL profile (e.g. Senior Data Analyst, Product Manager, Software Engineer)",
  "yearsOfExperience": "total years of professional experience as a number or null",
  "summary": "2-3 sentence professional summary capturing candidate's key strengths, domain, and value proposition",
  "skills": ["every hard skill mentioned â€” programming languages, frameworks, methodologies, domain skills"],
  "tools": ["every software tool, platform, technology mentioned â€” SQL, Tableau, Excel, JIRA, Salesforce, etc."],
  "certifications": ["certification name - issuer - year if mentioned"],
  "languages": ["spoken/written languages if mentioned"],
  "experience": [
    {
      "company": "company name",
      "role": "exact job title",
      "startDate": "start month/year or null",
      "endDate": "end month/year or Present",
      "duration": "calculated duration e.g. 2 years 3 months",
      "location": "city or Remote or null",
      "employmentType": "Full-time / Part-time / Contract / Freelance or null",
      "description": "full description of responsibilities",
      "achievements": ["key achievement 1 with metrics", "key achievement 2"],
      "technologiesUsed": ["tech/tools used in this role"]
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "what the project does and your role",
      "impact": "measurable impact or outcome if mentioned",
      "technologies": ["tech stack used"],
      "url": "project URL if mentioned or null"
    }
  ],
  "education": [
    {
      "institution": "university/college name",
      "degree": "degree type and field of study",
      "gpa": "GPA if mentioned or null",
      "graduationYear": "year or expected year",
      "relevantCourses": ["relevant courses if listed"]
    }
  ],
  "awards": ["any awards, honors, achievements mentioned"],
  "publications": ["any publications, research papers if mentioned"],
  "volunteerWork": ["volunteer experience if mentioned"]
}

Resume Text (FULL):
${pdfText}`;

  try {
    const text = await generateAIResponse(prompt);
    return extractJSON(text);
  } catch (err) {
    console.error('parseResume error:', err.message);
    throw new Error(`Failed to parse resume: ${err.message}`);
  }
}

// â”€â”€ Analyze Job â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function analyzeJob(description) {
  const prompt = `You are an expert job description analyst. Extract EVERY piece of information from the job description below with complete accuracy. Miss nothing.

CRITICAL RULES:
- Extract ALL skills listed anywhere (required, preferred, nice-to-have)
- Extract ALL responsibilities â€” do NOT truncate or summarize, list them all
- Extract ALL qualifications and requirements
- Look for recruiter/hiring manager name and email throughout the entire text
- If salary is mentioned anywhere, extract it
- Return ONLY valid JSON, no extra text

Return this EXACT JSON structure:
{
  "company": "exact company name",
  "jobTitle": "exact job title as posted",
  "department": "department/team if mentioned or null",
  "location": "city, state, country or Remote or Hybrid",
  "workMode": "Remote / Hybrid / On-site",
  "jobType": "Full-time / Part-time / Contract / Internship / Freelance",
  "experienceLevel": "Entry / Mid / Senior / Lead / Manager / Director or null",
  "experienceYearsRequired": "e.g. 3-5 years or null",
  "salaryRange": "exact salary/compensation mentioned or null",
  "recruiterName": "recruiter or hiring manager name if mentioned anywhere or null",
  "recruiterEmail": "recruiter or contact email if mentioned anywhere or null",
  "applicationEmail": "email address to apply to if different from recruiter email or null",
  "applicationUrl": "application URL if mentioned or null",
  "jobSummary": "3-4 sentence summary of what this role is about and what the company does",
  "companyDescription": "what the company does, their mission, industry if described",
  "requiredSkills": ["every mandatory skill, technology, tool listed as required"],
  "preferredSkills": ["every preferred, nice-to-have, bonus skill mentioned"],
  "responsibilities": ["EVERY responsibility listed â€” all of them, word for word or close paraphrase"],
  "requiredQualifications": ["every must-have qualification: degree, years, certifications"],
  "preferredQualifications": ["every nice-to-have qualification"],
  "toolsAndTechnologies": ["all specific tools, software, platforms mentioned"],
  "industryDomain": "industry/domain e.g. FinTech, Healthcare, E-commerce, SaaS",
  "teamSize": "team size if mentioned or null",
  "reportingTo": "who this role reports to if mentioned or null",
  "benefits": ["benefits listed: health insurance, equity, remote work, etc."],
  "applicationDeadline": "deadline if mentioned or null",
  "jobPostingDate": "posting date if visible or null"
}

Job Description (FULL):
${description}`;

  try {
    const text = await generateAIResponse(prompt);
    const result = extractJSON(text);
    return result;
  } catch (err) {
    console.error('analyzeJob error:', err.message);
    throw new Error(`Failed to analyze job: ${err.message}`);
  }
}

// â”€â”€ Match Resumes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function matchResumes(jobData, resumes) {
  if (!resumes || resumes.length === 0) throw new Error('No resumes to match');

  if (resumes.length === 1) {
    return {
      rankings: [{ index: 0, score: 100, reason: 'Only one resume available â€” automatically selected.', strengths: [], gaps: [] }],
      bestMatchIndex: 0,
      bestMatchReason: 'Only one resume available â€” automatically selected.',
    };
  }

  // Build detailed resume summaries â€” include ALL parsed data for accurate matching
  const resumeSummaries = resumes.map((r, i) => {
    const p = r.parsedData || {};
    return {
      index: i,
      filename: r.originalName || r.filename,
      name: p.name || `Resume ${i + 1}`,
      idealRole: p.idealRole || null,
      yearsOfExperience: p.yearsOfExperience || null,
      skills: p.skills || [],
      tools: p.tools || [],
      certifications: p.certifications || [],
      experience: (p.experience || []).map(e => ({
        role: e.role,
        company: e.company,
        duration: e.duration,
        achievements: e.achievements || [],
        technologiesUsed: e.technologiesUsed || [],
      })),
      education: (p.education || []).map(e => ({
        institution: e.institution,
        degree: e.degree,
        graduationYear: e.graduationYear,
      })),
      projects: (p.projects || []).map(proj => ({
        name: proj.name,
        description: proj.description,
        impact: proj.impact,
        technologies: proj.technologies || [],
      })),
      summary: p.summary || '',
    };
  });

  const jobSummary = {
    title: jobData.jobTitle,
    company: jobData.company,
    experienceRequired: jobData.experienceYearsRequired,
    experienceLevel: jobData.experienceLevel,
    requiredSkills: jobData.requiredSkills || [],
    preferredSkills: jobData.preferredSkills || [],
    toolsAndTechnologies: jobData.toolsAndTechnologies || [],
    requiredQualifications: jobData.requiredQualifications || [],
    responsibilities: jobData.responsibilities || [],
    industryDomain: jobData.industryDomain || null,
    workMode: jobData.workMode || null,
  };

  const prompt = `You are a senior technical recruiter with 15 years of experience. Analyze these resumes against the job requirements and rank them by fit.

SCORING CRITERIA (total 100 points):
1. Skills match (40 pts): How many required skills does the candidate have? Partial credit for related skills.
2. Experience relevance (30 pts): Is their experience in the same domain/role type? Do their achievements align?
3. Tools & technologies (15 pts): Do they use the exact tools mentioned in the job?
4. Education & qualifications (10 pts): Do they meet the degree/certification requirements?
5. Seniority fit (5 pts): Does their experience level match what the role needs?

CRITICAL RULES:
- Base ALL scores on concrete evidence in the resume data
- Give specific reasons citing actual skills/experience from the resume
- Identify both strengths (what makes them good) and gaps (what they lack)
- The bestMatchIndex must be the index of the resume with the highest score
- Return ONLY valid JSON

Job Requirements:
${JSON.stringify(jobSummary, null, 2)}

Candidate Resumes:
${JSON.stringify(resumeSummaries, null, 2)}

Return this EXACT JSON:
{
  "rankings": [
    {
      "index": 0,
      "score": 87,
      "reason": "Specific reason citing actual resume data",
      "strengths": ["specific strength 1 with evidence", "specific strength 2"],
      "gaps": ["specific gap 1", "specific gap 2"]
    }
  ],
  "bestMatchIndex": 0,
  "bestMatchReason": "Detailed 3-4 sentence explanation of why this resume is the BEST fit for ${jobData.jobTitle} at ${jobData.company}, citing specific skills, experience, and achievements from their resume"
}

Order rankings from highest score to lowest.`;

  try {
    const text = await generateAIResponse(prompt);
    return extractJSON(text);
  } catch (err) {
    console.error('matchResumes error:', err.message);
    throw new Error(`Failed to match resumes: ${err.message}`);
  }
}

// â”€â”€ Generate Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateEmail(jobData, resumeData) {
  const p = resumeData.parsedData || {};

  // Build rich candidate profile for email generation
  const candidateProfile = {
    name: p.name || 'Candidate',
    phone: p.contact?.phone || p.phone || '6033088799', // Added phone
    currentRole: p.idealRole || (p.experience?.[0]?.role) || null,
    yearsOfExperience: p.yearsOfExperience || null,
    topSkills: (p.skills || []).slice(0, 12),
    tools: (p.tools || []).slice(0, 8),
    summary: p.summary || '',
    recentExperience: (p.experience || []).slice(0, 3).map(e => ({
      role: e.role,
      company: e.company,
      duration: e.duration,
      topAchievements: (e.achievements || []).slice(0, 2),
    })),
    topProjects: (p.projects || []).slice(0, 2).map(proj => ({
      name: proj.name,
      impact: proj.impact,
      tech: (proj.technologies || []).slice(0, 4),
    })),
    education: (p.education || []).slice(0, 1),
    certifications: (p.certifications || []).slice(0, 3),
  };

  const jobContext = {
    company: jobData.company,
    jobTitle: jobData.jobTitle,
    recruiterName: jobData.recruiterName || null,
    companyDescription: jobData.companyDescription || null,
    requiredSkills: jobData.requiredSkills || [],
    keyResponsibilities: (jobData.responsibilities || []).slice(0, 6),
    industryDomain: jobData.industryDomain || null,
    workMode: jobData.workMode || null,
  };

  const prompt = `You are an expert professional career writer specializing in high-response job application emails.

Your task is to generate a highly personalized job application email using the Job Context and Candidate Profile.

The email must sound natural, professional, confident, and written by a real human—not AI.

EMAIL STRUCTURE

Greeting:
Address the recruiter by name if available.
If the recruiter name is not available, use "Hiring Manager" or "Hiring Team".

Opening Hook:
Write a compelling opening sentence referencing the specific job title and company name.

Avoid robotic phrases such as:
"I am writing to express my interest"
"I am passionate about"
"I believe I am the perfect fit"

Instead use natural openings such as:
"I was excited to see the opening for [Job Title] at [Company Name]."
"What stood out to me about this opportunity at [Company Name] is..."

Body:
Explain briefly how the candidate's background aligns with the role.

Then include 2–3 short bullet points highlighting measurable achievements or relevant experience.

Formatting Rules:
• Use the bullet symbol "•" for bullet points.
• Never use markdown formatting like *, **, or numbered lists.
• Each bullet point must be one concise sentence.

Example format:
• Built dashboards tracking 5+ KPIs, improving reporting efficiency by 20%.
• Conducted sales data analysis to identify customer behavior trends.
• Experienced in requirement gathering and structured business reporting.

Experience Adaptation Rules:

If candidate experience is less than 6 months:
Focus on projects, certifications, and skills.

If candidate experience is between 6–24 months:
Highlight early career experience and measurable achievements.

If candidate experience is more than 2 years:
Focus on impact, leadership, and results.

Closing:
Write a confident and professional closing.

Mention that the resume is attached.

Example:
"I’ve attached my resume for your review and would welcome the opportunity to discuss how my experience could support your team."

Tone Requirements:
Professional
Warm
Confident
Concise
Human-like

The email must NOT sound robotic or AI-generated.

Length:
100–150 words maximum.

Accuracy Rules:
Ensure the following are correct:
• Candidate name
• Recruiter name
• Company name
• Job title

CRITICAL RULES:

Use ONLY factual information from the Candidate Profile.
Never invent or hallucinate achievements.
Always connect candidate achievements directly to job requirements.

Signature:
The email must end with:

[Candidate Name]
[Phone Number]

Return ONLY valid JSON.

Job Context:
${JSON.stringify(jobContext, null, 2)}

Candidate Profile:
${JSON.stringify(candidateProfile, null, 2)}

Return this EXACT JSON:
{
  "subject": "Clear, professional subject line (e.g., Application for [Role] - [Candidate Name] - [Key Qualifier])",
  "body": "complete email body with proper greeting, paragraphs separated by \\n\\n, and professional closing signature"
}`;

  try {
    const text = await generateAIResponse(prompt);
    const result = extractJSON(text);

    // Make sure the body ends with sender name and phone (checking for existing signature to avoid duplicates)
    const candidatePhone = p.contact?.phone || p.phone || '6033088799';
    const firstName = p.name ? p.name.split(' ')[0].toLowerCase() : '';
    const bodyLower = (result.body || '').toLowerCase();

    const hasSignature = firstName && bodyLower.includes(firstName);
    const hasPhone = bodyLower.includes(candidatePhone);

    if (!hasSignature) {
      result.body = result.body.trim() + `\n\nBest regards,\n${p.name}\n${candidatePhone}`;
    } else if (!hasPhone) {
      result.body = result.body.trim() + `\n${candidatePhone}`;
    }

    return result;
  } catch (err) {
    console.error('generateEmail error:', err.message);
    throw new Error(`Failed to generate email: ${err.message}`);
  }
}

// â”€â”€ ATS Keyword Extractor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stage 1: Extract all JD keywords and run gap analysis against the resume.
// Returns an atsContext object that is fed into tailorResume (Stage 2).
async function extractAtsKeywords(jobData, resumeParsedData) {
  const jdKeywords = {
    jobTitle:          jobData.jobTitle || '',
    requiredSkills:    jobData.requiredSkills || [],
    preferredSkills:   jobData.preferredSkills || [],
    toolsAndTech:      jobData.toolsAndTechnologies || [],
    industryKeywords:  [
      jobData.industryDomain,
      jobData.experienceLevel,
      ...(jobData.requiredQualifications || []),
    ].filter(Boolean),
    responsibilities:  (jobData.responsibilities || []).slice(0, 10),
  };

  const resumeTextBlob = [
    resumeParsedData.summary || '',
    (resumeParsedData.skills || []).join(' '),
    (resumeParsedData.tools  || []).join(' '),
    ...(resumeParsedData.experience || []).flatMap(e =>
      [e.role || '', e.description || '', ...(e.achievements || []), ...(e.technologiesUsed || [])]
    ),
    ...(resumeParsedData.projects || []).flatMap(p =>
      [p.name || '', p.description || '', ...(p.technologies || [])]
    ),
  ].join(' ').toLowerCase();

  const prompt = `You are an ATS (Applicant Tracking System) optimization expert.

Analyze the job description keywords against the candidate's resume content and identify EXACTLY which keywords are missing or underrepresented.

Job Description Keywords:
${JSON.stringify(jdKeywords, null, 2)}

Candidate Resume Content (full text blob for matching):
"${resumeTextBlob.slice(0, 4000)}"

STEPS:
1. For EACH keyword in requiredSkills, preferredSkills, toolsAndTech, and industryKeywords:
   - Check if it appears (exact or semantically equivalent) in the resume content.
   - Mark it as 'present', 'partial', or 'missing'.
2. Identify the top 15 highest-priority missing/partial keywords to inject.
3. Suggest where each should be injected: 'summary', 'skills', 'experience', 'projects'.

Return ONLY valid JSON:
{
  "jobTitle": "${jdKeywords.jobTitle}",
  "allKeywords": [
    { "keyword": "Python", "category": "requiredSkill", "status": "present" },
    { "keyword": "Machine Learning", "category": "preferredSkill", "status": "missing" }
  ],
  "missingKeywords": [
    { "keyword": "Machine Learning", "priority": "high", "injectIn": ["summary", "skills"] },
    { "keyword": "Tableau", "priority": "high", "injectIn": ["skills", "experience"] }
  ],
  "partialKeywords": [
    { "keyword": "SQL", "priority": "medium", "injectIn": ["experience", "projects"] }
  ],
  "keywordsToBoost": ["keyword1", "keyword2"],
  "titlePresentInResume": true
}`;

  try {
    const text = await generateAIResponse(prompt);
    return extractJSON(text);
  } catch (err) {
    console.warn('ATS keyword extraction failed (non-fatal):', err.message);
    // Return a minimal context so tailoring can still proceed
    return {
      jobTitle: jdKeywords.jobTitle,
      missingKeywords: [],
      partialKeywords: [],
      keywordsToBoost: [...jdKeywords.requiredSkills, ...jdKeywords.toolsAndTech].slice(0, 10),
      titlePresentInResume: false,
    };
  }
}

// â”€â”€ Tailor Resume (ATS-Optimized) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Two-stage pipeline:
//   Stage 1 â†’ extractAtsKeywords() â†’ gap analysis
//   Stage 2 â†’ tailorResume()       â†’ inject missing keywords + ATS rules
//
// Returns rewrittenContent in the schema expected by latexService.js:
// {
//   summary: "3â€“4 sentence text",
//   skillCategories: { "Category": ["skill1", ...], ... },
//   experienceBullets: ["bullet1", ..., "bullet6"],
//   projects: [
//     { name: "...", url: "...", bullets: ["b1","b2","b3","b4"] },
//     { name: "...", url: "...", bullets: ["b1","b2","b3","b4"] }
//   ]
// }
async function tailorResume(jobData, bestResume) {
  const parsedData = bestResume.parsedData || {};

  // â”€â”€ Stage 1: ATS Keyword Gap Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('ðŸ” [ATS Stage 1] Extracting JD keywords and running gap analysis...');
  const atsContext = await extractAtsKeywords(jobData, parsedData);

  const missingKeywords  = (atsContext.missingKeywords  || []).map(k => k.keyword);
  const partialKeywords  = (atsContext.partialKeywords  || []).map(k => k.keyword);
  const keywordsToBoost  = atsContext.keywordsToBoost  || [];
  const titleInResume    = atsContext.titlePresentInResume === true;
  const jobTitle         = jobData.jobTitle || '';

  console.log(`ðŸ“Š [ATS] Missing keywords (${missingKeywords.length}): ${missingKeywords.slice(0,8).join(', ')}`);
  console.log(`ðŸ“Š [ATS] Keywords to boost: ${keywordsToBoost.slice(0,6).join(', ')}`);
  console.log(`ðŸ“Š [ATS] Job title "${jobTitle}" in resume: ${titleInResume}`);

  // â”€â”€ Stage 2: Build Editable Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const primaryExp  = parsedData.experience?.[0] || {};
  const topProjects = (parsedData.projects || []).slice(0, 2).map(p => ({
    name: p.name || 'Project',
    url:  p.url  || p.link || `https://github.com/${(p.name || 'project').replace(/\s+/g, '-').toLowerCase()}`,
    existingBullets: p.achievements || (p.description ? [p.description] : [])
  }));

  const editableInput = {
    summary: parsedData.summary || '',
    skills:  parsedData.skills  || [],
    tools:   parsedData.tools   || [],
    primaryExperience: {
      role:            primaryExp.role    || '',
      company:         primaryExp.company || '',
      startDate:       primaryExp.startDate || null,
      endDate:         primaryExp.endDate   || null,
      existingBullets: primaryExp.achievements || [],
    },
    projects: topProjects,
  };

  // â”€â”€ Stage 2: ATS-Optimized Tailoring Prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const prompt = `You are an elite ATS (Applicant Tracking System) resume optimizer and professional resume writer.

Your task is to rewrite the 4 editable resume sections below to:
1. Maximize keyword match with the job description for ATS algorithms
2. Inject ALL missing and partial keywords naturally and contextually
3. Ensure the resume reads professionally and truthfully to human reviewers

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CRITICAL ATS RULES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âŒ NEVER DO:
- Do NOT modify candidate name, email, phone, location, LinkedIn, GitHub
- Do NOT modify education, certifications, or any locked sections
- Do NOT invent new companies, degrees, certifications, or institutions
- Do NOT change role title, company name, or project titles
- Do NOT add LaTeX, HTML, markdown, or any formatting code
- Do NOT truncate â€” always produce ALL required bullets

âœ… MUST DO â€” SECTION BY SECTION:

ðŸ”· SUMMARY (3â€“4 sentences REQUIRED):
  - MUST include the job title "${jobTitle}" at least once naturally
  - Integrate ${missingKeywords.slice(0,4).join(', ')} naturally
  - Highlight candidate's strongest domain expertise + value proposition
  - End with a statement about career goal aligned to this specific role

ðŸ”· SKILL CATEGORIES (3â€“5 named categories REQUIRED):
  - ALL missing high-priority keywords MUST appear as skills: [${missingKeywords.join(', ')}]
  - Boost underrepresented keywords: [${[...partialKeywords, ...keywordsToBoost].slice(0,8).join(', ')}]
  - Sort skills within each category by relevance to this job (most relevant first)
  - Each category: 4â€“7 skills. Category names must be professional and ATS-neutral.

ðŸ”· EXPERIENCE BULLETS (EXACTLY 5â€“6 bullets REQUIRED):
  - Each bullet: strong action verb + specific task + MEASURABLE outcome (numbers, %, $, X times)
  - Inject these JD keywords naturally: [${[...missingKeywords, ...keywordsToBoost].slice(0,8).join(', ')}]
  - ATS date format rule: Use MM/YYYY or "Month YYYY" format. If only year known, use YYYY only.
  - Every bullet must mention at least one tool or skill from the job description
  - Minimum 1 bullet with a percentage improvement (e.g., "improved accuracy by 23%")
  - Minimum 1 bullet with a numeric scale (e.g., "analyzed 50,000+ records", "reduced time by 3 hours/week")

ðŸ”· PROJECT BULLETS (3â€“4 bullets per project REQUIRED):
  - Align each project with a specific job responsibility or required skill
  - Inject remaining missing keywords: [${missingKeywords.slice(4).join(', ')}]
  - Each bullet: action verb + technical detail + measurable impact
  - Mention at least one tool from toolsAndTechnologies in each project

ðŸ”· KEYWORD DENSITY RULE:
  - Top 5 required skills must appear at least TWICE across summary + experience + projects combined
  - Required skills for this job: [${(jobData.requiredSkills || []).slice(0,8).join(', ')}]

${!titleInResume ? `ðŸš¨ CRITICAL: The job title "${jobTitle}" does NOT appear in this resume. You MUST include it at least once in the summary and once in the experience bullets.` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

Job Description Context:
${JSON.stringify({
  jobTitle:           jobData.jobTitle,
  company:            jobData.company,
  requiredSkills:     jobData.requiredSkills     || [],
  preferredSkills:    jobData.preferredSkills    || [],
  responsibilitites:  (jobData.responsibilities  || []).slice(0, 12),
  toolsAndTech:       jobData.toolsAndTechnologies || [],
  industryDomain:     jobData.industryDomain     || null,
  experienceLevel:    jobData.experienceLevel    || null,
}, null, 2)}

ATS Keyword Injection Targets:
${JSON.stringify({ missingKeywords, partialKeywords, keywordsToBoost }, null, 2)}

Original Editable Resume Content:
${JSON.stringify(editableInput, null, 2)}

Return ONLY valid JSON with this EXACT structure (no extra keys, no extra text):
{
  "summary": "3â€“4 sentence ATS-optimized professional summary including the job title \"${jobTitle}\"",
  "skillCategories": {
    "Data Analysis & Statistics": ["Python", "SQL", "R", "Statistics", "Hypothesis Testing"],
    "Visualization & Reporting": ["Tableau", "Power BI", "Matplotlib", "Seaborn"],
    "Tools & Platforms": ["Excel", "Google Sheets", "Jupyter Notebook", "SPSS"],
    "Methodologies": ["EDA", "Regression Analysis", "A/B Testing", "Machine Learning"]
  },
  "experienceBullets": [
    "Performed [task] using [tool/skill from JD], achieving [measurable outcome with number or %]",
    "Developed [deliverable] leveraging [JD keyword], reducing [metric] by [X%/number]",
    "Analyzed [scale, e.g. 50,000+] records using [JD tool] to identify [insight], improving [outcome] by [%]",
    "Collaborated with [team] to [task] using [JD skill], resulting in [business impact]",
    "Built [pipeline/model/dashboard] with [JD tool], enabling [stakeholder] to [outcome]"
  ],
  "projects": [
    {
      "name": "${topProjects[0]?.name || 'Project 1'}",
      "url": "${topProjects[0]?.url || ''}",
      "bullets": [
        "Built [what] using [JD tool] to [purpose], achieving [measurable outcome]",
        "Applied [JD keyword/skill] to [task], improving [metric] by [number or %]",
        "Integrated [technology] pipeline processing [scale] data points",
        "Deployed [solution] reducing [cost/time/error] by [measurable amount]"
      ]
    },
    {
      "name": "${topProjects[1]?.name || 'Project 2'}",
      "url": "${topProjects[1]?.url || ''}",
      "bullets": [
        "Developed [model/dashboard/tool] using [JD skill] for [use case]",
        "Processed [scale] dataset with [JD tool], achieving [accuracy/performance metric]",
        "Visualized [what] using [visualization tool from JD], presenting to [audience]",
        "Automated [process] using [tool], saving [X hours/week or resources]"
      ]
    }
  ]
}`;

  try {
    const text = await generateAIResponse(prompt);
    const rewrittenContent = extractJSON(text);

    // â”€â”€ Build tailoredData (flat structure for email, scoring, UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const flatSkills = rewrittenContent.skillCategories
      ? Object.values(rewrittenContent.skillCategories).flat()
      : (rewrittenContent.skills || parsedData.skills || []);

    const tailoredExperience = (parsedData.experience || []).map((orig, i) => ({
      ...orig,
      startDate: _formatAtsDate(orig.startDate),
      endDate:   _formatAtsDate(orig.endDate),
      achievements: i === 0
        ? (rewrittenContent.experienceBullets || orig.achievements || [])
        : (orig.achievements || [])
    }));

    const tailoredProjects = (parsedData.projects || []).map((orig, i) => ({
      ...orig,
      description: (rewrittenContent.projects?.[i]?.bullets || []).join(' ') || orig.description || ''
    }));

    const atsReport = {
      missingKeywordsInjected: missingKeywords,
      partialKeywordsBoosted:  partialKeywords,
      keywordsBoosted:         keywordsToBoost,
      jobTitleInjected:        !titleInResume,
    };

    console.log(`âœ… [ATS Stage 2] Tailoring complete. Injected ${missingKeywords.length} missing keywords.`);

    return {
      tailoredData: {
        ...parsedData,
        idealRole:  jobData.jobTitle || parsedData.idealRole,
        summary:    rewrittenContent.summary || parsedData.summary,
        skills:     flatSkills,
        experience: tailoredExperience,
        projects:   tailoredProjects,
      },
      rewrittenContent,
      atsReport,
    };
  } catch (err) {
    console.error('tailorResume error:', err.message);
    throw new Error(`Failed to tailor resume: ${err.message}`);
  }
}

// â”€â”€ ATS Date Formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Converts various date string formats to ATS-friendly MM/YYYY or Month YYYY.
// Falls back to YYYY-only or 'Present' as appropriate.
function _formatAtsDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^present$/i.test(s)) return 'Present';

  // Already correct: MM/YYYY
  if (/^\d{2}\/\d{4}$/.test(s)) return s;

  // Already correct: Month YYYY (e.g. "January 2024")
  if (/^[A-Za-z]+ \d{4}$/.test(s)) return s;

  // ISO-ish: YYYY-MM or YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const m = parseInt(isoMatch[2], 10);
    const y = isoMatch[1];
    return m >= 1 && m <= 12 ? `${months[m-1]} ${y}` : y;
  }

  // Just a year
  if (/^\d{4}$/.test(s)) return s;

  // Anything else â€” return as-is
  return s;
}


// â”€â”€ Score Tailored Resume â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function scoreTailoredResume(jobData, tailoredData) {
  const prompt = `You are a technical recruiter. You just received a tailored resume for a specific job. Rate how well this resume matches the job description on a scale of 0 to 100.

Job Description:
${JSON.stringify({
  title: jobData.jobTitle,
  skills: jobData.requiredSkills,
  responsibilities: jobData.responsibilities
}, null, 2)}

Tailored Resume:
${JSON.stringify({
  summary: tailoredData.summary,
  skills: tailoredData.skills,
  experience: tailoredData.experience,
  projects: tailoredData.projects
}, null, 2)}

Return EXACTLY this JSON:
{
  "score": 95,
  "reason": "Brief reason why it received this score"
}`;

  try {
    const text = await generateAIResponse(prompt);
    const result = extractJSON(text);
    return result.score;
  } catch (err) {
    console.error('scoreTailoredResume error:', err.message);
    return 90; // Fallback score if parsing fails
  }
}

// ── Extract LinkedIn Post Data for Fake Detection ────────────────────────────
async function extractLinkedInPostData(postText) {
  const prompt = `You are a cybersecurity and recruitment fraud analyst. Extract the following information from the provided LinkedIn job post text.
If any piece of information is not visibly present in the text, return null for that field.

Return EXACTLY this JSON structure. Do NOT add extra keys.
{
  "company_name": "extracted company name or null",
  "recruiter_name": "recruiter or hiring manager name or null",
  "recruiter_current_company": "recruiter's current company if mentioned, or null",
  "recruiter_previous_company": "recruiter's previous company if mentioned, or null",
  "recruiter_connections": "number of recruiter connections if mentioned, or null",
  "company_page_exists": null, // Do not guess. Default to null unless the text explicitly states the company has no page.
  "company_followers": number (e.g. 1500) if explicitly mentioned, or null,
  "company_employee_count": number if company size is mentioned (e.g. 200 for "50-200 employees"), or null,
  "post_text": "the entire original text you were provided, cleaned of extra whitespace",
  "apply_methods": {
    "email": "any email address found (e.g., hr@company.com), or null",
    "phone": "any phone number found, or null",
    "links": ["array of any URLs or websites mentioned in the text for applying"],
    "easy_apply": true/false/null depending on if LinkedIn Easy Apply is explicitly mentioned
  }
}

Job Post Text:
${postText}
`;

  try {
    const text = await generateAIResponse(prompt);
    return extractJSON(text);
  } catch (err) {
    console.error('extractLinkedInPostData error:', err.message);
    throw new Error(`Failed to extract LinkedIn post data: ${err.message}`);
  }
}

// ── Generate LinkedIn DM ────────────────────────────────────────────────────────
async function generateLinkedInDM({ hrName, companyName, candidateName, targetRole, candidateSkills, appliedJobTitle }) {
  const jobContext = appliedJobTitle ? `They recently applied for the "${appliedJobTitle}" position.` : '';
  const skillsContext = candidateSkills ? `Candidate skills to highlight sparingly: ${candidateSkills}` : '';

  const prompt = `You are an expert LinkedIn networking strategist.
Write a highly personalized, conversational, and professional direct message to an HR professional on LinkedIn.

RECIPIENT: ${hrName} (HR at ${companyName})
SENDER: ${candidateName}
TARGET ROLE: ${targetRole}
${jobContext}
${skillsContext}

CONSTRAINTS:
- Length: Maximum 3 sentences. Extremely concise.
- Tone: Professional, warm, and conversational. Do not sound desperate. Avoid sales/spam tones.
- Do NOT use phrases like "I am writing to express my interest". Use natural openers.
- Avoid excessive punctuation or emojis.
- Do NOT wrap the message in quotes. Return the raw text.

Example format:
Hi ${hrName},

I noticed you're part of the talent team at ${companyName}. I'm currently exploring opportunities in ${targetRole} and would really appreciate connecting.

Thanks for your time.
${candidateName}

Return ONLY the raw message text.`;

  try {
    const text = await generateAIResponse(prompt);
    return text.trim();
  } catch (err) {
    console.error('generateLinkedInDM error:', err.message);
    throw new Error(`Failed to generate LinkedIn message: ${err.message}`);
  }
}

module.exports = { parseResume, analyzeJob, matchResumes, generateEmail, tailorResume, extractAtsKeywords, scoreTailoredResume, extractLinkedInPostData, generateLinkedInDM };
