#!/usr/bin/env node
/**
 * probe-hn.mjs — verify Hacker News Algolia API reachability from this machine and inspect payload shapes.
 * Saves raw responses to data/snapshot/probe/ for later fixtures.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'snapshot', 'probe');
await mkdir(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) llm-pulse/0.1';

const since = Math.floor(Date.now() / 1000) - 7 * 86400;
const url = `https://hn.algolia.com/api/v1/search?query=AI&tags=story&numericFilters=created_at_i%3E${since},points%3E30&hitsPerPage=30`;
const t0 = Date.now();
const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
const payload = await res.json();
console.log(`search: HTTP ${res.status} in ${Date.now() - t0}ms hits=${payload.hits?.length} nbHits=${payload.nbHits}`);
await writeFile(join(OUT, 'hn-search.json'), JSON.stringify(payload, null, 2) + '\n');
for (const hit of (payload.hits || []).slice(0, 5)) {
  console.log(`- ${hit.objectID} | points=${hit.points} comments=${hit.num_comments} | ${hit.title} | ${hit.url || '(no url)'} | created_at_i=${hit.created_at_i}`);
}

const first = payload.hits?.[0];
if (first) {
  const t1 = Date.now();
  const itemRes = await fetch(`https://hn.algolia.com/api/v1/items/${first.objectID}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
  const item = await itemRes.json();
  console.log(`\nitem ${first.objectID}: HTTP ${itemRes.status} in ${Date.now() - t1}ms children=${item.children?.length} title=${item.title}`);
  // Save only non-PII shape evidence (counts), never raw usernames/comment bodies.
  const firstComment = (item.children || []).find((c) => c.text);
  const shapeEvidence = {
    objectID: first.objectID,
    childrenCount: (item.children || []).length,
    firstCommentTextLength: firstComment?.text?.length ?? 0,
    topLevelCommentsWithText: (item.children || []).filter((c) => c.text).length,
  };
  await writeFile(join(OUT, `hn-item-shape-${first.objectID}.json`), JSON.stringify(shapeEvidence, null, 2) + '\n');
  console.log('shape evidence:', JSON.stringify(shapeEvidence));
  // check points presence on comments
  const withPoints = (item.children || []).filter((c) => typeof c.points === 'number');
  console.log('top-level comments with numeric points:', withPoints.length, '/', (item.children || []).length);
}
