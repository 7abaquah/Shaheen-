#!/usr/bin/env node
// Gate runner (code node). One fixed evaluator for every node of the graph.
//
//   node scripts/gate.mjs <nodeId> [--attempt N] [--no-log]
//   node scripts/gate.mjs --freeze          recompute graph/frozen.sha256 (lead only)
//   node scripts/gate.mjs --check-map       verify that node ownership globs are disjoint
//
// Checks, in order (deterministic first):
//   frozen     the evaluator files (contracts, acceptance tests, configs, sources) are unchanged
//   ownership  every file changed since HEAD belongs to a node of the stage being run
//   types      tsc diagnostics, restricted to the node's files and its acceptance tests
//   lint       eslint on the node's files
//   tests      the node's acceptance tests (+ its own unit tests)
//   extra      node-specific commands listed in graph/graph.json
//
// Exit code 0 only when every check passes. Each run is appended to graph/gate-log.jsonl,
// failed attempts included.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(readFileSync(path.join(ROOT, 'graph', 'graph.json'), 'utf8'));
const FROZEN_FILE = path.join(ROOT, 'graph', 'frozen.sha256');
const LOG_FILE = path.join(ROOT, 'graph', 'gate-log.jsonl');

const globToRegExp = (glob) => new RegExp('^' + glob
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*\//g, '\u0000')
  .replace(/\*\*/g, '\u0001')
  .replace(/\*/g, '[^/]*')
  .replace(/\u0000/g, '(?:.*/)?')
  .replace(/\u0001/g, '.*') + '$');
const matcher = (globs) => {
  const res = globs.map(globToRegExp);
  return (p) => res.some((re) => re.test(p));
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(path.relative(ROOT, full).split(path.sep).join('/'));
  }
  return out;
}

const sha256 = (file) => createHash('sha256').update(readFileSync(path.join(ROOT, file))).digest('hex');

function frozenFiles() {
  const isFrozen = matcher(graph.frozen);
  return walk(ROOT).filter(isFrozen).sort();
}

function run(cmd, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' }, ...opts });
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), ms: Date.now() - started };
}

const tail = (text, lines = 12) => text.trim().split('\n').slice(-lines).join('\n');

// ── --freeze / --check-map ──────────────────────────────────────────────────
if (process.argv.includes('--freeze')) {
  const files = frozenFiles();
  writeFileSync(FROZEN_FILE, files.map((f) => `${sha256(f)}  ${f}`).join('\n') + '\n');
  console.log(`froze ${files.length} files → graph/frozen.sha256`);
  process.exit(0);
}

function checkMap() {
  const files = walk(ROOT);
  const owners = new Map();
  const problems = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    const owns = matcher(node.owns ?? []);
    for (const f of files) {
      if (!owns(f)) continue;
      if (owners.has(f)) problems.push(`${f} is owned by both ${owners.get(f)} and ${id}`);
      owners.set(f, id);
    }
  }
  // Globs may overlap on files that do not exist yet: test with one synthetic path per glob.
  const entries = Object.entries(graph.nodes).flatMap(([id, n]) => (n.owns ?? []).map((g) => [id, g]));
  for (const [idA, globA] of entries) {
    const sample = globA.replace(/\*\*\//g, 'x/').replace(/\*\*/g, 'x/y.ts').replace(/\*/g, 'x');
    for (const [idB, node] of Object.entries(graph.nodes)) {
      if (idB !== idA && matcher(node.owns ?? [])(sample)) problems.push(`${globA} (${idA}) overlaps the globs of ${idB}`);
    }
  }
  const frozen = matcher(graph.frozen);
  for (const [f, id] of owners) if (frozen(f) && graph.nodes[id].kind === 'agent') problems.push(`${f} is frozen but owned by agent node ${id}`);
  return problems;
}

if (process.argv.includes('--check-map')) {
  const problems = checkMap();
  for (const p of problems) console.log('✗', p);
  console.log(problems.length ? `${problems.length} ownership problems` : 'ownership map is disjoint');
  process.exit(problems.length ? 1 : 0);
}

// ── gate for one node ───────────────────────────────────────────────────────
const nodeId = process.argv[2];
const node = graph.nodes[nodeId];
if (!node) {
  console.error(`usage: node scripts/gate.mjs <${Object.keys(graph.nodes).join('|')}>`);
  process.exit(2);
}
const attemptArg = process.argv.indexOf('--attempt');
const attempt = attemptArg > 0 ? Number(process.argv[attemptArg + 1]) : 1;
const results = [];
const record = (check, pass, evidence) => {
  results.push({ check, verdict: pass ? 'pass' : 'fail', evidence });
  console.log(`${pass ? '✓' : '✗'} ${nodeId}.${check}${pass ? '' : '\n' + evidence.split('\n').map((l) => '    ' + l).join('\n')}`);
};

// 1. frozen evaluator
{
  if (!existsSync(FROZEN_FILE)) record('frozen', false, 'graph/frozen.sha256 is missing — run `node scripts/gate.mjs --freeze` (lead only)');
  else {
    const want = new Map(readFileSync(FROZEN_FILE, 'utf8').trim().split('\n').map((l) => { const [h, ...f] = l.split('  '); return [f.join('  '), h]; }));
    const have = frozenFiles();
    const bad = [];
    for (const [f, h] of want) {
      if (!existsSync(path.join(ROOT, f))) bad.push(`deleted: ${f}`);
      else if (sha256(f) !== h) bad.push(`modified: ${f}`);
    }
    for (const f of have) if (!want.has(f)) bad.push(`added to a frozen area: ${f}`);
    record('frozen', bad.length === 0, bad.length ? bad.join('\n') : `${want.size} evaluator files match graph/frozen.sha256`);
  }
}

// 2. ownership
{
  const stage = graph.stages.find((s) => s.includes(nodeId)) ?? [nodeId];
  const stageOwns = matcher(stage.flatMap((id) => graph.nodes[id].owns ?? []));
  const leadOwns = matcher(graph.leadOwned ?? []);
  const mine = matcher(node.owns ?? []);
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' });
  const changed = status.split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
  const outside = changed.filter((f) => !stageOwns(f) && !leadOwns(f));
  const own = changed.filter(mine);
  const needsOutput = node.kind === 'agent' && (node.owns ?? []).length > 0;
  const tracked = needsOutput && own.length === 0
    ? execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(mine).length
    : own.length;
  const pass = outside.length === 0 && (!needsOutput || tracked > 0);
  record('ownership', pass, outside.length
    ? `files changed outside the stage's ownership (${stage.join(', ')}):\n${outside.join('\n')}`
    : needsOutput && tracked === 0 ? `no output: nothing exists under ${node.owns.join(', ')}`
    : `${changed.length} changed files, all inside stage ${stage.join('+')}; ${own.length} belong to ${nodeId}`);
}

// 3. types (diagnostics restricted to this node's scope)
if (node.typeScope) {
  const inScope = matcher(node.typeScope);
  const r = run('npx', ['tsc', '--noEmit', '--pretty', 'false']);
  const diags = r.out.split('\n').filter((l) => /\(\d+,\d+\): error TS\d+/.test(l)).filter((l) => inScope(l.slice(0, l.indexOf('('))));
  record('types', diags.length === 0, diags.length ? `${diags.length} type errors:\n${diags.slice(0, 40).join('\n')}` : `tsc: 0 errors in ${node.typeScope.join(', ')} (${r.ms} ms)`);
}

// 4. lint
if (node.lint) {
  const targets = node.lint.filter((t) => existsSync(path.join(ROOT, t)));
  if (targets.length === 0) record('lint', false, `nothing to lint: ${node.lint.join(', ')} do not exist`);
  else {
    const r = run('npx', ['eslint', '--max-warnings', '0', ...targets]);
    record('lint', r.code === 0, r.code === 0 ? `eslint clean: ${targets.join(', ')} (${r.ms} ms)` : tail(r.out, 60));
  }
}

// 5. tests
for (const t of node.tests ?? []) {
  const args = ['vitest', 'run', ...t.paths, ...(t.name ? ['-t', t.name] : []), '--reporter=dot'];
  const r = run('npx', args);
  const summary = r.out.split('\n').filter((l) => /^\s*(Test Files|Tests)\s/.test(l)).map((l) => l.trim()).join(' · ');
  const ran = /Tests\s+.*\d+ passed/.test(r.out);
  record(`tests:${t.id}`, r.code === 0 && ran, r.code === 0 && ran ? `${summary} (${r.ms} ms)` : tail(r.out, 80));
}

// 6. extra commands
for (const x of node.extra ?? []) {
  const r = run(x.cmd[0], x.cmd.slice(1));
  record(x.id, r.code === 0, r.code === 0 ? tail(r.out, 3) : tail(r.out, 60));
}

const pass = results.every((r) => r.verdict === 'pass');
mkdirSync(path.join(ROOT, 'graph', '.state'), { recursive: true });
writeFileSync(path.join(ROOT, 'graph', '.state', `gate-${nodeId}.json`), JSON.stringify({ node: nodeId, attempt, pass, results }, null, 2));
if (!process.argv.includes('--no-log')) {
  appendFileSync(LOG_FILE, JSON.stringify({
    at: new Date().toISOString(), node: nodeId, attempt, verdict: pass ? 'pass' : 'fail',
    checks: Object.fromEntries(results.map((r) => [r.check, r.verdict])),
    failed: results.filter((r) => r.verdict === 'fail').map((r) => ({ check: r.check, evidence: r.evidence.slice(0, 600) })),
  }) + '\n');
}
console.log(`\n${nodeId}: ${pass ? 'GATE OPEN' : 'GATE CLOSED'} (${results.filter((r) => r.verdict === 'pass').length}/${results.length} checks)`);
process.exit(pass ? 0 : 1);
