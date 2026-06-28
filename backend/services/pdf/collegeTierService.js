const geminiService = require('../gemini/geminiService');

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in tier response');
  return JSON.parse(match[0]);
}

/**
 * Use Gemini to estimate college tier from reputable ranking frameworks.
 * Considers institution, degree/course, and optional JD context.
 */
async function evaluateCollegeTier(institution, degree, jobData = null, options = {}) {
  if (!institution) {
    return {
      tier: 3,
      tierLabel: 'Tier 3',
      placeEducationAtTop: false,
      reasoning: 'No college institution found in resume.',
      sourcesConsidered: [],
    };
  }

  const jobTitle = jobData?.jobTitle || 'Not specified';
  const requiredQual = (jobData?.requiredQualifications || []).slice(0, 5).join('; ');

  const prompt = `You are an expert on university and college rankings. Using knowledge aligned with reputable sources such as NIRF (India), QS World University Rankings, Times Higher Education, and relevant program-specific rankings (engineering, management, etc.), classify the candidate's college and degree.

Institution: ${institution}
Degree / Course: ${degree || 'Not specified'}
Target role: ${jobTitle}
Job qualifications context: ${requiredQual || 'Not specified'}

Rules:
- Tier 1: Globally/nationally elite (e.g. IITs, IIMs, IISc, AIIMS, BITS Pilani, top IIT/NIT-level institutes, top 50 NIRF overall or in the relevant category, internationally ranked top universities).
- Tier 2: Strong reputed institutes (NITs, IIITs, well-known state/central universities, top 100 NIRF in relevant category, strong program reputation for the candidate's field).
- Tier 3: Other institutes without strong national ranking signal.
- Consider BOTH institution AND course relevance to the job when available.
- placeEducationAtTop must be true for Tier 1 and Tier 2, false for Tier 3.

Return ONLY valid JSON:
{
  "tier": 1,
  "tierLabel": "Tier 1",
  "placeEducationAtTop": true,
  "reasoning": "one sentence",
  "sourcesConsidered": ["NIRF", "QS"]
}`;

  try {
    const text = await geminiService.generateAIResponse(prompt, { ...options, json: true });
    const parsed = typeof text === 'string' ? extractJSON(text) : text;
    const tier = Math.min(3, Math.max(1, Number(parsed.tier) || 3));
    return {
      tier,
      tierLabel: parsed.tierLabel || `Tier ${tier}`,
      placeEducationAtTop: tier === 1 || tier === 2,
      reasoning: parsed.reasoning || '',
      sourcesConsidered: parsed.sourcesConsidered || [],
    };
  } catch (err) {
    console.warn('⚠️ College tier evaluation failed, defaulting to Tier 3:', err.message);
    return {
      tier: 3,
      tierLabel: 'Tier 3',
      placeEducationAtTop: false,
      reasoning: 'Tier evaluation unavailable.',
      sourcesConsidered: [],
    };
  }
}

module.exports = { evaluateCollegeTier };
