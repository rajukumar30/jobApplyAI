// content.js — JobApply AI connections extractor
// Injected into the LinkedIn connections page via chrome.scripting.executeScript

async function autoScrollAndExtract() {
  const TARGET_URL = 'https://www.linkedin.com/mynetwork/invite-connect/connections/';

  if (!window.location.href.startsWith(TARGET_URL)) {
    return { error: 'Please navigate to your LinkedIn Connections page first: ' + TARGET_URL };
  }

  const uniqueConnections = new Map();
  const MAX_CONNECTIONS = window.JOBAPPLY_EXTRACT_LIMIT || 2000;

  // ── Tuning ────────────────────────────────────────────────────────────────
  const MAX_STABLE = 15;      // passes with zero new connections before stopping
  const SCROLL_WAIT_MS = 3500; // wait after each scroll for LinkedIn to lazy-load
  const INITIAL_WAIT_MS = 4000; // wait for initial SPA render

  chrome.runtime.sendMessage({ type: 'PROGRESS', payload: '⏳ Waiting for LinkedIn to render…' });
  await sleep(INITIAL_WAIT_MS);

  // ── Find the real scrollable container ────────────────────────────────────
  // LinkedIn uses an inner fixed-height <main> element, NOT window.
  function getScrollable() {
    const candidates = [
      '.scaffold-layout__main',
      'main',
      '.scaffold-layout-container',
      '.mn-connections',
      '.scaffold-finite-scroll',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      // Must be actually scrollable
      if (el && el.scrollHeight > el.clientHeight + 50) return el;
    }
    // Fallback: find the deepest element that has overflow-y scroll/auto
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all.reverse()) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === 'scroll' || style.overflowY === 'auto') &&
        el.scrollHeight > el.clientHeight + 50
      ) {
        return el;
      }
    }
    return null; // will fall back to window
  }

  // ── Scroll helper ─────────────────────────────────────────────────────────
  async function scrollDown() {
    const container = getScrollable();

    if (container) {
      container.scrollTop = container.scrollHeight; // jump to very bottom
      container.scrollBy({ top: 3000, behavior: 'smooth' });
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
    }

    // Also scroll the window (belt-and-suspenders)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    window.scrollBy({ top: 3000, behavior: 'smooth' });
    window.dispatchEvent(new Event('scroll', { bubbles: true }));
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
  }

  // ── "Show More" button clicker ────────────────────────────────────────────
  function tryClickShowMore() {
    const explicit = document.querySelector('.scaffold-finite-scroll__load-button');
    if (explicit) { explicit.click(); return true; }

    const btn = Array.from(document.querySelectorAll('button')).find(b => {
      const t = (b.innerText || '').toLowerCase();
      return t.includes('show more') || t.includes('load more') || t.includes('see more');
    });
    if (btn) { btn.click(); return true; }
    return false;
  }

  // ── Extraction ────────────────────────────────────────────────────────────
  function extractVisible() {
    // LinkedIn connection cards: anchor contains ≥2 <p> tags (name + headline)
    const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));

    profileLinks.forEach(link => {
      const pTags = link.querySelectorAll('p');

      if (pTags.length >= 2) {
        const name = (pTags[0].innerText || '').replace("Member's name", '').trim();
        let rawTitle = (pTags[1].innerText || '').trim();
        const profileUrl = link.href.split('?')[0];

        if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
          rawTitle = rawTitle.slice(1, -1).trim();
        }

        if (name && rawTitle && !uniqueConnections.has(name + profileUrl)) {
          const match = rawTitle.match(/(?:at|\||-|@|—)\s*(.+)/i);
          const company = match ? match[1].trim() : '';
          uniqueConnections.set(name + profileUrl, { name, title: rawTitle, company, profileUrl });
        }
      }

      // ── Fallback: try span/div text nodes when no <p> tags exist ──────────
      if (pTags.length === 0) {
        const profileUrl = link.href.split('?')[0];
        if (uniqueConnections.has('__' + profileUrl)) return; // already tried

        // Collect direct text children (spans / divs)
        const spans = Array.from(link.querySelectorAll('span, div')).filter(el => {
          return el.children.length === 0 && (el.innerText || '').trim().length > 1;
        });

        const name = (spans[0]?.innerText || '').trim();
        const rawTitle = (spans[1]?.innerText || '').trim();

        if (name && rawTitle && !uniqueConnections.has(name + profileUrl)) {
          const match = rawTitle.match(/(?:at|\||-|@|—)\s*(.+)/i);
          const company = match ? match[1].trim() : '';
          uniqueConnections.set(name + profileUrl, { name, title: rawTitle, company, profileUrl });
        } else {
          uniqueConnections.set('__' + profileUrl, true); // mark as tried
        }
      }
    });
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  let stableIterations = 0;
  let previousCount = 0;

  while (stableIterations < MAX_STABLE && uniqueConnections.size < MAX_CONNECTIONS) {
    await scrollDown();
    const clicked = tryClickShowMore();

    chrome.runtime.sendMessage({
      type: 'PROGRESS',
      payload: `📡 Scrolling… ${uniqueConnections.size} connections found (pass ${stableIterations + 1}/${MAX_STABLE})`
    });

    await sleep(clicked ? SCROLL_WAIT_MS + 1200 : SCROLL_WAIT_MS);

    extractVisible();

    const currentCount = uniqueConnections.size;
    if (currentCount === previousCount) {
      stableIterations++;
    } else {
      stableIterations = 0;
    }
    previousCount = currentCount;
  }

  // Final pass
  extractVisible();

  // Remove internal sentinel keys used in fallback
  const results = Array.from(uniqueConnections.entries())
    .filter(([key]) => !key.startsWith('__'))
    .map(([, val]) => val);

  chrome.runtime.sendMessage({
    type: 'PROGRESS',
    payload: results.length >= MAX_CONNECTIONS
      ? `✅ Limit reached. Extracted ${results.length} connections.`
      : `✅ Done! Found ${results.length} connections.`
  });

  return { success: true, count: results.length, data: results };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

autoScrollAndExtract();
