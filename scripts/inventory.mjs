#!/usr/bin/env node
// N0 (code node) — deterministic inventory of the source projects.
//
// Reads every file in sources/ (verified against sources/SHA256SUMS), parses it
// with a real parser, and extracts — without any model judgment —
//   • every static data literal (named constants and inline arrays), with colours resolved,
//   • every feature id (tab / page comparisons),
//   • every AI call site and model id,
//   • simulation markers (Math.random) and security claims made in UI text.
//
// Output: graph/inventory.json (overview) and graph/.state/blobs.json (full data blobs,
// consumed by scripts/build-catalog.mjs). Re-runnable on a new source set: drop files in
// sources/, refresh SHA256SUMS, run `npm run inventory`.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Parser } from 'acorn';
import jsx from 'acorn-jsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'sources');
const JsxParser = Parser.extend(jsx());

const AI_FUNCS = new Set(['callAgent', 'callAI', 'callAngel']);
const FEATURE_VARS = new Set(['tab', 'activeTab', 'page']);
const CLAIM_RE = /AES-256|مشف[ّ]?ر|QUANTUM|سليم 100%|100% آمن|الربط(?: البنكي)? الآمن|تلقائي(?:اً)? خلال|غير قابل|مضمون/;

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function verifyChecksums() {
  const sums = readFileSync(path.join(SRC_DIR, 'SHA256SUMS'), 'utf8')
    .split('\n').filter(Boolean)
    .map((l) => l.trim().split(/\s+/));
  const out = {};
  for (const [hash, name] of sums) {
    const got = sha256(readFileSync(path.join(SRC_DIR, name)));
    if (got !== hash) throw new Error(`checksum mismatch for sources/${name}`);
    out[name] = hash;
  }
  const present = readdirSync(SRC_DIR).filter((f) => f.endsWith('.jsx')).sort();
  const listed = Object.keys(out).sort();
  if (JSON.stringify(present) !== JSON.stringify(listed)) {
    throw new Error(`sources/ and SHA256SUMS disagree: ${present} vs ${listed}`);
  }
  return out;
}

// Generic AST walk (acorn-walk does not know JSX nodes).
function walk(node, visit, ancestors = []) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, ancestors);
  const next = ancestors.concat(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    const v = node[key];
    if (Array.isArray(v)) for (const c of v) walk(c, visit, next);
    else if (v && typeof v.type === 'string') walk(v, visit, next);
  }
}

const NOT_STATIC = Symbol('not-static');

// Evaluate a node only if it is pure data. `tokens` is the file's design-token object (T).
function staticValue(node, tokens) {
  switch (node.type) {
    case 'Literal':
      return node.regex ? NOT_STATIC : node.value;
    case 'TemplateLiteral':
      return node.expressions.length === 0 ? node.quasis[0].value.cooked : NOT_STATIC;
    case 'UnaryExpression': {
      if (node.operator !== '-' && node.operator !== '+') return NOT_STATIC;
      const v = staticValue(node.argument, tokens);
      return typeof v === 'number' ? (node.operator === '-' ? -v : v) : NOT_STATIC;
    }
    case 'MemberExpression': {
      if (node.computed || node.object.type !== 'Identifier' || node.object.name !== 'T') return NOT_STATIC;
      const v = tokens?.[node.property.name];
      return v === undefined ? NOT_STATIC : v;
    }
    case 'ArrayExpression': {
      const out = [];
      for (const el of node.elements) {
        if (!el || el.type === 'SpreadElement') return NOT_STATIC;
        const v = staticValue(el, tokens);
        if (v === NOT_STATIC) return NOT_STATIC;
        out.push(v);
      }
      return out;
    }
    case 'ObjectExpression': {
      const out = {};
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.computed || p.method || p.kind !== 'init') return NOT_STATIC;
        const key = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
        const v = staticValue(p.value, tokens);
        if (v === NOT_STATIC) return NOT_STATIC;
        out[key] = v;
      }
      return out;
    }
    default:
      return NOT_STATIC;
  }
}

function enclosingFunction(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i];
    if (a.type === 'FunctionDeclaration' && a.id) return a.id.name;
    if ((a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression')) {
      const p = ancestors[i - 1];
      if (p?.type === 'VariableDeclarator' && p.id.type === 'Identifier') return p.id.name;
    }
  }
  return null;
}

// Name of the first parameter of the `.map(cb)` this array feeds, e.g. [..].map(g => ..) -> "g".
function mapParam(node, ancestors) {
  const member = ancestors[ancestors.length - 1];
  const call = ancestors[ancestors.length - 2];
  if (member?.type !== 'MemberExpression' || member.object !== node) return null;
  if (member.property?.name !== 'map' || call?.type !== 'CallExpression') return null;
  const p = call.arguments[0]?.params?.[0];
  if (!p) return null;
  if (p.type === 'Identifier') return p.name;
  if (p.type === 'ArrayPattern') return '[' + p.elements.map((e) => e?.name ?? '_').join(',') + ']';
  return null;
}

function inventoryFile(name) {
  const text = readFileSync(path.join(SRC_DIR, name), 'utf8');
  const ast = JsxParser.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const id = name.replace(/\.jsx$/, '');

  // Pass 1: design tokens (top-level `const T = {...}` or component-local `const C = {...}`).
  let tokens = null;
  for (const stmt of ast.body) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations) {
      if (d.id.name === 'T' && d.init?.type === 'ObjectExpression') tokens = staticValue(d.init, null);
    }
  }
  if (tokens === NOT_STATIC) tokens = null;

  const blobs = [];
  const features = new Map();
  const aiCalls = [];
  const models = new Set();
  const claims = [];
  let mathRandom = 0;
  let directApiFetch = 0;
  const claimed = new Set();

  walk(ast, (node, ancestors) => {
    const line = node.loc.start.line;

    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init &&
        (node.init.type === 'ArrayExpression' || node.init.type === 'ObjectExpression')) {
      const v = staticValue(node.init, tokens);
      if (v !== NOT_STATIC) {
        blobs.push({ src: id, name: node.id.name, fn: enclosingFunction(ancestors), line, value: v });
        claimed.add(node.init);
      }
    }

    if (node.type === 'ArrayExpression' && !claimed.has(node) && node.elements.length >= 2) {
      const parent = ancestors[ancestors.length - 1];
      const insideClaimed = ancestors.some((a) => claimed.has(a));
      if (!insideClaimed && parent?.type !== 'ArrayExpression' && parent?.type !== 'Property') {
        const v = staticValue(node, tokens);
        if (v !== NOT_STATIC) {
          blobs.push({ src: id, name: null, fn: enclosingFunction(ancestors), line, mapParam: mapParam(node, ancestors), value: v });
          claimed.add(node);
        }
      }
    }

    if (node.type === 'BinaryExpression' && node.operator === '===' &&
        node.left.type === 'Identifier' && FEATURE_VARS.has(node.left.name) &&
        node.right.type === 'Literal' && typeof node.right.value === 'string') {
      if (!features.has(node.right.value)) features.set(node.right.value, line);
    }

    if (node.type === 'CallExpression') {
      const c = node.callee;
      if (c.type === 'Identifier' && AI_FUNCS.has(c.name)) {
        const first = node.arguments[0];
        aiCalls.push({
          via: c.name,
          fn: enclosingFunction(ancestors),
          line,
          agentArg: first?.type === 'Literal' && typeof first.value === 'string' ? first.value : null,
        });
      }
      if (c.type === 'Identifier' && c.name === 'fetch') {
        const u = node.arguments[0];
        if (u?.type === 'Literal' && /api\.anthropic\.com/.test(String(u.value))) {
          directApiFetch++;
          const fn = enclosingFunction(ancestors);
          if (!AI_FUNCS.has(fn)) aiCalls.push({ via: 'fetch', fn, line, agentArg: null });
        }
      }
      if (c.type === 'MemberExpression' && c.object.name === 'Math' && c.property.name === 'random') mathRandom++;
    }

    if (node.type === 'Literal' && typeof node.value === 'string' && /^claude-/.test(node.value)) models.add(node.value);

    const txt = node.type === 'JSXText' ? node.value.trim()
      : node.type === 'Literal' && typeof node.value === 'string' ? node.value
      : node.type === 'TemplateElement' ? node.value.cooked : null;
    if (txt && txt.length < 200 && CLAIM_RE.test(txt)) claims.push({ line, text: txt.replace(/\s+/g, ' ') });
  });

  return {
    id,
    overview: {
      file: `sources/${name}`,
      lines: text.split('\n').length,
      namedConstants: blobs.filter((b) => b.name).map((b) => ({ name: b.name, fn: b.fn, line: b.line, size: Array.isArray(b.value) ? b.value.length : Object.keys(b.value).length })),
      inlineLists: blobs.filter((b) => !b.name).map((b) => ({ fn: b.fn, line: b.line, mapParam: b.mapParam, size: b.value.length })),
      features: [...features].map(([fid, line]) => ({ id: fid, line })),
      aiCallSites: aiCalls,
      directApiFetchFromBrowser: directApiFetch,
      models: [...models].sort(),
      mathRandomCalls: mathRandom,
      securityClaimsInUiText: claims,
    },
    blobs,
  };
}

const checksums = verifyChecksums();
const files = Object.keys(checksums).sort();
const results = files.map(inventoryFile);

const inventory = {
  generatedBy: 'scripts/inventory.mjs',
  checksums,
  sources: Object.fromEntries(results.map((r) => [r.id, r.overview])),
};
mkdirSync(path.join(ROOT, 'graph', '.state'), { recursive: true });
writeFileSync(path.join(ROOT, 'graph', 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(path.join(ROOT, 'graph', '.state', 'blobs.json'), JSON.stringify(results.flatMap((r) => r.blobs), null, 1) + '\n');

for (const r of results) {
  const o = r.overview;
  console.log(`${r.id}: ${o.lines} lines · ${o.namedConstants.length} constants · ${o.inlineLists.length} inline lists · ${o.features.length} features · ${o.aiCallSites.length} AI call sites · Math.random×${o.mathRandomCalls}`);
}
console.log('wrote graph/inventory.json and graph/.state/blobs.json');
