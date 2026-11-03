#!/usr/bin/env node
/** probe-aa.mjs — locate the full Artificial Analysis leaderboard page (the homepage initialData only carries 28 featured models) */
import { parseAaInitialData, normalizeAaRankings } from '../normalize.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse/0.1';
const urls = [
  'https://artificialanalysis.ai/leaderboards/models',
  'https://artificialanalysis.ai/models',
  'https://artificialanalysis.ai/leaderboards',
  'https://artificialanalysis.ai/',
];
for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
    const html = await res.text();
    const raw = parseAaInitialData(html);
    const board = normalizeAaRankings(raw, { updatedAt: new Date().toISOString() });
    console.log(`${res.status} ${html.length}B ${url} → initialData=${raw.length} withIndex=${board?.entries.length ?? 0}${board ? ' top=' + board.entries[0].model : ''}`);
    // Extra stats: count occurrences of intelligenceIndex on the page
    console.log(`   intelligenceIndex occurrences: ${(html.match(/intelligenceIndex/g) || []).length}`);
  } catch (e) {
    console.log(`FAIL ${url} ${e.name}: ${e.message}`);
  }
}
