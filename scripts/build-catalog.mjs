#!/usr/bin/env node
// N0b (code node) — deterministic merge + dedupe of the data extracted by scripts/inventory.mjs.
//
// Every dataset below is produced by an explicit rule: a base source (wins on conflict) plus
// additional sources that only contribute missing entries. Conflicts are never resolved
// silently — they are written to graph/catalog-report.json.
//
// Outputs
//   shared/catalog.json                    public data, each dataset tagged with its provenance
//   server/src/generated/personas.json     server-only prompt personas (never shipped to the browser)
//   graph/catalog-report.json              merge decisions, conflicts, dropped datasets

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blobs = JSON.parse(readFileSync(path.join(ROOT, 'graph', '.state', 'blobs.json'), 'utf8'));
const sourceText = (id) => readFileSync(path.join(ROOT, 'sources', `${id}.jsx`), 'utf8');

const GREEN = 'shahin-green-media';
const CAMP = 'shahin-campaign';
const NEXUS = 'shahin-nexus';
const SUPER = 'shaheen-superapp';

const conflicts = [];

function blob(src, sel) {
  const hit = blobs.filter((b) => b.src === src && (typeof sel === 'number' ? !b.name && b.line === sel : b.name === sel));
  if (hit.length === 0) throw new Error(`no blob ${src}:${sel}`);
  return { value: structuredClone(hit[0].value), ref: `${src}:${typeof sel === 'number' ? 'L' + sel : sel}@L${hit[0].line}` };
}

// Union by key. `base` wins; later lists only add entries whose key is missing.
// Differing fields on shared keys are recorded as conflicts.
function unionBy(dataset, key, lists) {
  const out = new Map();
  for (const { items, ref } of lists) {
    for (const item of items) {
      const k = item[key];
      if (!out.has(k)) { out.set(k, { ...item }); continue; }
      const kept = out.get(k);
      for (const f of Object.keys(item)) {
        if (!(f in kept)) kept[f] = item[f];
        else if (JSON.stringify(kept[f]) !== JSON.stringify(item[f])) {
          conflicts.push({ dataset, key: k, field: f, kept: kept[f], discarded: item[f], discardedFrom: ref });
        }
      }
    }
  }
  return [...out.values()];
}

const rename = (items, map) => items.map((it) => Object.fromEntries(Object.entries(it).map(([k, v]) => [map[k] ?? k, v])));
const data = {};
const meta = {};
function put(key, value, provenance, from, demoFields) {
  data[key] = value;
  meta[key] = { provenance, from, ...(demoFields ? { demoFields } : {}) };
}

// ── themes (design tokens of each source, colours as written) ───────────────
{
  const s = blob(SUPER, 'T'); const n = blob(NEXUS, 'T'); const g = blob(GREEN, 'C');
  put('themes', { superapp: s.value, nexus: n.value, greenMedia: g.value }, 'config', [s.ref, n.ref, g.ref]);
}

// ── marketing ───────────────────────────────────────────────────────────────
{
  const n = blob(NEXUS, 'PLATFORMS'); const c = blob(CAMP, 'PLATFORMS');
  put('platforms', unionBy('platforms', 'id', [{ items: n.value, ref: n.ref }, { items: c.value, ref: c.ref }]), 'config', [n.ref, c.ref]);
}
{
  const c = blob(CAMP, 364); const n = blob(NEXUS, 533);
  if (JSON.stringify(c.value) !== JSON.stringify(n.value)) conflicts.push({ dataset: 'campaignGoals', kept: c.value, discarded: n.value, discardedFrom: n.ref });
  put('campaignGoals', c.value, 'config', [c.ref, n.ref]);
}
{
  const c = blob(CAMP, 375); const n = blob(NEXUS, 538);
  if (JSON.stringify(c.value) !== JSON.stringify(n.value)) conflicts.push({ dataset: 'campaignTones', kept: c.value, discarded: n.value, discardedFrom: n.ref });
  put('campaignTones', c.value, 'config', [c.ref, n.ref]);
}

// ── energy studio ───────────────────────────────────────────────────────────
{
  const g = blob(GREEN, 'SECTORS'); const n = blob(NEXUS, 'SECTORS'); const p = blob(NEXUS, 'pcts');
  const sectors = unionBy('sectors', 'id', [{ items: g.value, ref: g.ref }, { items: n.value, ref: n.ref }]);
  // The green-media source drew these bars with Math.random(); the nexus source fixed them
  // to constants. The constants are used; sectors without one get null (bar hidden).
  const share = Object.fromEntries(n.value.map((s, i) => [s.id, p.value[i]]));
  for (const s of sectors) s.sharePct = share[s.id] ?? null;
  put('sectors', sectors, 'demo', [g.ref, n.ref, p.ref], ['market', 'sharePct']);
}
{
  const g = blob(GREEN, 'MEDIA_TYPES'); const n = blob(NEXUS, 'MEDIA_TYPES');
  put('mediaTypes', unionBy('mediaTypes', 'id', [{ items: g.value, ref: g.ref }, { items: rename(n.value, { dur: 'duration' }), ref: n.ref }]), 'config', [g.ref, n.ref]);
}
{
  const g = blob(GREEN, 'AGENTS'); const n = blob(NEXUS, 'PIPELINE');
  put('pipelineAgents', unionBy('pipelineAgents', 'id', [{ items: g.value, ref: g.ref }, { items: n.value, ref: n.ref }]), 'config', [g.ref, n.ref]);
}
{
  const g = blob(GREEN, 'INVESTOR_PROFILES'); const n = blob(NEXUS, 'INVESTORS');
  const profiles = g.value.map((p, i) => ({
    id: `inv-${i + 1}`, name: p.name, budget: p.budget, interestPct: parseInt(p.interest, 10), flag: p.flag, priority: p.priority,
  }));
  n.value.forEach((p, i) => {
    const k = profiles[i];
    if (!k) return;
    if (k.interestPct !== p.pct) conflicts.push({ dataset: 'investorProfiles', key: k.id, field: 'interestPct', kept: k.interestPct, discarded: p.pct, discardedFrom: n.ref });
    if (k.name !== p.name) conflicts.push({ dataset: 'investorProfiles', key: k.id, field: 'name', kept: k.name, discarded: p.name, discardedFrom: n.ref });
    if (k.priority !== p.priority) conflicts.push({ dataset: 'investorProfiles', key: k.id, field: 'priority', kept: k.priority, discarded: p.priority, discardedFrom: n.ref });
  });
  put('investorProfiles', profiles, 'demo', [g.ref, n.ref], ['budget', 'interestPct', 'priority']);
}

// ── offers + referral tree ──────────────────────────────────────────────────
{
  const n = blob(NEXUS, 'OFFER_TIERS'); const c = blob(CAMP, 'OFFER_TEMPLATES');
  const ids = { 500: 'gold', 200: 'silver', 50: 'bronze' };
  const withId = (items) => items.map((t) => ({ id: ids[t.price] ?? `tier-${t.price}`, ...t }));
  put('offerTiers', unionBy('offerTiers', 'id', [{ items: withId(n.value), ref: n.ref }, { items: withId(c.value), ref: c.ref }]), 'demo', [n.ref, c.ref], ['price', 'bonus', 'perks']);
}
{
  const s = blob(SUPER, 'TREE_DATA'); const n = blob(NEXUS, 'TREE_ROOT'); const c = blob(CAMP, 'TREE_DATA');
  const norm = (node, level = 0) => ({
    name: node.name, code: node.code, earnings: node.earn ?? node.earnings, level,
    children: node.children.map((ch) => norm(ch, level + 1)),
  });
  const tree = norm(s.value);
  for (const other of [n, c]) {
    if (JSON.stringify(norm(other.value)) !== JSON.stringify(tree)) conflicts.push({ dataset: 'referralTree', kept: s.ref, discardedFrom: other.ref });
  }
  put('referralTree', tree, 'demo', [s.ref, n.ref, c.ref]);
}
{
  const s = blob(SUPER, 836); const n = blob(NEXUS, 671); const c = blob(CAMP, 524);
  put('treeStats', s.value.map((x) => ({ label: x.l, value: x.v, color: x.c })), 'demo', [s.ref, n.ref, c.ref]);
}
{
  const s = blob(SUPER, 852);
  put('commissionLevels', s.value.map(([level, rate, note]) => ({ level, rate, note })), 'demo', [s.ref]);
}
{
  const c = blob(CAMP, 502);
  put('referralSteps', c.value, 'config', [c.ref]);
}
{
  const codes = new Set();
  for (const id of [CAMP, NEXUS, SUPER]) for (const m of sourceText(id).matchAll(/SHN-REF-[A-Z0-9]+/g)) codes.add(m[0]);
  if (codes.size !== 1) conflicts.push({ dataset: 'referralCode', values: [...codes] });
  put('referralCode', [...codes][0], 'demo', ['regex SHN-REF-* in campaign/nexus/superapp']);
}

// ── organisation / command ──────────────────────────────────────────────────
{ const b = blob(NEXUS, 'DIVISIONS'); put('divisions', b.value, 'config', [b.ref]); }
{ const b = blob(NEXUS, 'STATS'); put('dashboardStats', b.value, 'demo', [b.ref]); }
{ const b = blob(NEXUS, 509); put('orgSummary', b.value.map(([value, label]) => ({ value, label })), 'demo', [b.ref]); }
{ const b = blob(NEXUS, 'BUGS'); put('bugRegistry', b.value, 'config', [b.ref]); }
{ const b = blob(NEXUS, 877); put('engineerSuggestions', b.value, 'config', [b.ref]); }
{
  // Legacy tab/page id -> merged module id (see graph/feature-map.json for the full table).
  const target = { campaign: 'campaign', energy: 'studio', investors: 'investors', tree: 'tree', market: 'market', store: 'store', agents: 'angels', wallet: 'wallet' };
  const n = blob(NEXUS, 491); const s = blob(SUPER, 469);
  const norm = (items, k) => items.map((a) => ({ label: a.l, icon: a.icon, target: target[a[k]], color: a.c }));
  put('quickActions', unionBy('quickActions', 'target', [{ items: norm(n.value, 't'), ref: n.ref }, { items: norm(s.value, 'p'), ref: s.ref }]), 'config', [n.ref, s.ref]);
}

// ── super app ───────────────────────────────────────────────────────────────
const personas = { angels: {} };
{
  const b = blob(SUPER, 'ANGELS');
  put('angels', b.value.map(({ soul, col, ...pub }) => { personas.angels[pub.id] = soul; return { ...pub, color: col }; }), 'config', [b.ref]);
}
{ const b = blob(SUPER, 'LAYERS'); put('layers', rename(b.value, { col: 'color' }), 'demo', [b.ref], ['metrics', 'desc']); }
{ const b = blob(SUPER, 610); put('sovereignSummary', b.value.map(([value, label, color]) => ({ value, label, color })), 'demo', [b.ref]); }
{ const b = blob(SUPER, 'LOG'); put('sovereignBootLog', rename(b.value, { col: 'color' }), 'demo', [b.ref]); }
{ const b = blob(SUPER, 'TOKEN_ALLOC'); put('tokenAllocation', rename(b.value, { col: 'color' }), 'demo', [b.ref]); }
{ const b = blob(SUPER, 563); put('contractInfo', b.value.map(([label, value]) => ({ label, value })), 'demo', [b.ref]); }
{ const b = blob(SUPER, 'PRODUCTS'); put('products', b.value, 'demo', [b.ref], ['price', 'shn', 'rating', 'reviews', 'badge']); }
{ const b = blob(SUPER, 'CATS'); put('productCategories', b.value, 'config', [b.ref]); }
{ const b = blob(SUPER, 'PROPOSALS'); put('proposals', b.value, 'demo', [b.ref]); }
{ const b = blob(SUPER, 'statusCol'); put('proposalStatusColors', b.value, 'config', [b.ref]); }
{ const b = blob(SUPER, 487); put('newsTicker', b.value, 'demo', [b.ref]); }
{ const b = blob(SUPER, 883); put('walletActions', b.value.map((a) => ({ label: a.l, icon: a.i })), 'config', [b.ref]); }
{ const b = blob(SUPER, 894); put('walletTokenStats', b.value.map((x) => ({ label: x.l, value: x.v, color: x.c })), 'demo', [b.ref]); }
{ const b = blob(SUPER, 'txns'); put('walletTransactions', rename(b.value, { col: 'color' }), 'demo', [b.ref]); }

// ── bank linking ────────────────────────────────────────────────────────────
{
  const n = blob(NEXUS, 742); const s = blob(SUPER, 925);
  const fromOptions = [...sourceText(CAMP).matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1].trim());
  const banks = [];
  for (const name of [...n.value[0].opts, ...s.value[0].opts, ...fromOptions]) if (!banks.includes(name)) banks.push(name);
  put('bankOptions', banks, 'config', [n.ref, s.ref, `${CAMP}:<option> elements`]);
}
{ const b = blob(NEXUS, 736); put('bankFormSteps', b.value, 'config', [b.ref]); }
{
  const b = blob(NEXUS, 790);
  put('demoPayouts', b.value.map((x) => ({ label: x.l, value: x.v, when: x.t, color: x.c })), 'demo', [b.ref]);
}

// ── datasets deliberately not carried over ──────────────────────────────────
const dropped = [
  { ref: blob(NEXUS, 'steps').ref, reason: 'Scripted "scan" that always printed "النظام سليم 100%" after fixed delays. Replaced by the kernel\'s real self-test results.' },
  { ref: `${SUPER}:genHistory / price interval`, reason: 'Math.random price series. Kept as a simulation in the shell, labelled as simulated; not stored as data.' },
];

mkdirSync(path.join(ROOT, 'shared'), { recursive: true });
mkdirSync(path.join(ROOT, 'server', 'src', 'generated'), { recursive: true });
const banner = 'GENERATED by scripts/build-catalog.mjs from sources/ — do not edit by hand.';
writeFileSync(path.join(ROOT, 'shared', 'catalog.json'), JSON.stringify({ _: banner, meta, data }, null, 1) + '\n');
writeFileSync(path.join(ROOT, 'server', 'src', 'generated', 'personas.json'), JSON.stringify({ _: banner, ...personas }, null, 1) + '\n');
writeFileSync(path.join(ROOT, 'graph', 'catalog-report.json'), JSON.stringify({
  generatedBy: 'scripts/build-catalog.mjs',
  datasets: Object.fromEntries(Object.entries(meta).map(([k, m]) => [k, { ...m, entries: Array.isArray(data[k]) ? data[k].length : undefined }])),
  conflicts,
  dropped,
}, null, 2) + '\n');

const demo = Object.values(meta).filter((m) => m.provenance === 'demo').length;
console.log(`catalog: ${Object.keys(data).length} datasets (${demo} demo, ${Object.keys(data).length - demo} config) · ${conflicts.length} conflicts recorded · ${dropped.length} dropped`);
for (const c of conflicts) console.log('  conflict:', JSON.stringify(c).slice(0, 200));
