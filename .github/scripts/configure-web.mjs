// يضبط الموقع قبل النشر من متغيرات المستودع حتى لا يُعدَّل API في مكانين يدويًا.
// Writes web/js/config.js, the CSP connect-src in web/_headers, and the site domain, from SHN_* variables.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.argv[2] || 'web';
const https = (name) => {
  const v = (process.env[name] || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w\-./]*)?$/i.test(v)) throw new Error(`${name} must be an https URL`);
  return v;
};
const apiBase = https('SHN_API_BASE');
const appUrl = https('SHN_APP_URL');
const site = https('SHN_WEBSITE_URL');
const siteKey = (process.env.SHN_TURNSTILE_SITE_KEY || '').trim();
if (siteKey && !/^[\w-]+$/.test(siteKey)) throw new Error('SHN_TURNSTILE_SITE_KEY has invalid characters');

if (!apiBase) {
  console.log('SHN_API_BASE not set: website deploys with forms disabled.');
} else {
  const cfgPath = join(WEB, 'js/config.js');
  const cfg = readFileSync(cfgPath, 'utf8')
    .replace(/API_BASE:\s*'[^']*'/, `API_BASE: '${apiBase}'`)
    .replace(/APP_URL:\s*'[^']*'/, `APP_URL: '${appUrl || 'https://app.shaheen.example'}'`)
    .replace(/TURNSTILE_SITE_KEY:\s*'[^']*'/, `TURNSTILE_SITE_KEY: '${siteKey || 'REPLACE_WITH_TURNSTILE_SITE_KEY'}'`);
  writeFileSync(cfgPath, cfg);
  const apiOrigin = new URL(apiBase).origin;
  const hdrPath = join(WEB, '_headers');
  const hdr = readFileSync(hdrPath, 'utf8').replace(/connect-src 'self'[^;]*;/, `connect-src 'self' ${apiOrigin};`);
  writeFileSync(hdrPath, hdr);
  console.log(`API ${apiBase} → config.js and connect-src ${apiOrigin}`);
}

if (site) {
  const origin = new URL(site).origin;
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  let n = 0;
  for (const f of walk(WEB).filter((f) => /\.(html|xml|txt)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    const out = s.replace(/https:\/\/shaheen\.example/g, origin);
    if (out !== s) { writeFileSync(f, out); n++; }
  }
  console.log(`Domain ${origin} written to ${n} files.`);
}
