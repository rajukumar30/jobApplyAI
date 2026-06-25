const zlib = require('zlib');

// ── Extract hyperlink URLs from a PDF buffer ─────────────────────────────────
// pdf-parse only returns visible TEXT, so clickable links whose anchor text is
// just a label (e.g. "GitHub", "LinkedIn", "Portfolio") are lost — the actual
// URLs live in the PDF's link annotations (/URI). This reads those URIs straight
// from the raw bytes, including URIs stored inside FlateDecode-compressed
// streams (common with object streams from Word / LaTeX hyperref output).
//
// Returns: { links: string[], linkedIn: string|null, github: string|null, website: string|null }

const URI_REGEX = /\/URI\s*\(([^)]*)\)/g;

function decodePdfString(raw) {
  if (!raw) return '';
  // Unescape the common PDF literal-string escapes (\( \) \\ ).
  return raw
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function collectUris(text, out) {
  if (!text) return;
  let match;
  URI_REGEX.lastIndex = 0;
  while ((match = URI_REGEX.exec(text)) !== null) {
    const url = decodePdfString(match[1]);
    if (url) out.add(url);
  }
}

function extractFromCompressedStreams(buffer, out) {
  const latin1 = buffer.toString('latin1');
  const streamRegex = /stream\r?\n/g;
  let m;
  while ((m = streamRegex.exec(latin1)) !== null) {
    const start = m.index + m[0].length;
    const end = latin1.indexOf('endstream', start);
    if (end === -1) continue;
    // Slice the raw bytes (not the latin1 string) so inflate gets valid input.
    const chunk = buffer.subarray(start, end);
    try {
      const inflated = zlib.inflateSync(chunk).toString('latin1');
      collectUris(inflated, out);
    } catch {
      // Not a flate stream (or trailing bytes) — ignore.
    }
  }
}

function classifyLinks(links) {
  let linkedIn = null;
  let github = null;
  let website = null;

  for (const link of links) {
    const lower = link.toLowerCase();
    if (lower.startsWith('mailto:') || lower.startsWith('tel:')) continue;
    if (!linkedIn && (lower.includes('linkedin.com') || lower.includes('lnkd.in'))) {
      linkedIn = link;
    } else if (!github && lower.includes('github.com')) {
      github = link;
    } else if (!website && /^https?:\/\//i.test(link)) {
      website = link;
    }
  }

  return { linkedIn, github, website };
}

function extractPdfLinks(buffer) {
  const out = new Set();

  try {
    // Pass 1: uncompressed annotations sitting directly in the page objects.
    collectUris(buffer.toString('latin1'), out);
    // Pass 2: annotations packed inside FlateDecode object streams.
    extractFromCompressedStreams(buffer, out);
  } catch (err) {
    console.warn('extractPdfLinks failed (non-fatal):', err.message);
  }

  const links = [...out].filter(u => /^(https?:\/\/|www\.)/i.test(u));
  const classified = classifyLinks(links);
  return { links, ...classified };
}

module.exports = { extractPdfLinks };
