// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { describe, expect, it } from 'vitest';
import type { Schema } from '../../contract.ts';
import { api } from './helpers.ts';

describe('validateIban', () => {
  it('accepts valid IBANs in any spacing or case and returns the compact form', () => {
    const valid: [string, string, string][] = [
      ['SA03 8000 0000 6080 1016 7519', 'SA0380000000608010167519', 'SA'],
      ['sa0380000000608010167519', 'SA0380000000608010167519', 'SA'],
      ['AE07 0331 2345 6789 0123 456', 'AE070331234567890123456', 'AE'],
      ['EG38 0019 0005 0000 0000 2631 8000 2', 'EG380019000500000000263180002', 'EG'],
      ['  GB82 WEST 1234 5698 7654 32 ', 'GB82WEST12345698765432', 'GB'],
      ['DE89370400440532013000', 'DE89370400440532013000', 'DE'],
    ];
    for (const [input, iban, country] of valid) {
      expect(api.validateIban(input), input).toEqual({ ok: true, iban, country });
    }
  });

  it('rejects bad input with a specific reason', () => {
    const invalid: [string, string][] = [
      ['', 'empty'],
      ['   ', 'empty'],
      ['SA03 8000 0000 6080 1016 7518', 'checksum'],
      ['SA00 0000 0000 0000 0000 0000', 'checksum'], // the placeholder shown in the original forms
      ['SA03 8000 0000 6080 1016 75', 'length'],
      ['SA03 8000 0000 6080 1016 7519 00', 'length'],
      ['SA03-8000-0000-6080-1016-7519', 'chars'],
      ['SA03 8000 0000 6080 1016 75١٩', 'chars'],
      ['<script>alert(1)</script>', 'chars'],
      ['1234 5678 9012 3456 7890 1234', 'country'],
      ['ZZ03 8000 0000 6080 1016 7519', 'country'],
    ];
    for (const [input, reason] of invalid) {
      expect(api.validateIban(input), input).toEqual({ ok: false, reason });
    }
  });
});

describe('maskIban', () => {
  it('keeps the country and the last four characters only', () => {
    const masked = api.maskIban('SA0380000000608010167519');
    expect(masked.replace(/\s/g, '')).toBe('SA' + '•'.repeat(18) + '7519');
    expect(masked).toMatch(/^\S{4}( \S{4})*$/);
    expect(masked).not.toContain('0380');
    expect(masked).not.toContain('6080');
  });
});

describe('boundedText', () => {
  it('trims, strips control characters and enforces bounds', () => {
    expect(api.boundedText('  مرحبا  ', { max: 20 })).toEqual({ ok: true, value: 'مرحبا' });
    expect(api.boundedText('a\u0000b\u0007c\u001bd', { max: 20 })).toEqual({ ok: true, value: 'abcd' });
    expect(api.boundedText('line1\nline2\tend', { max: 20 })).toEqual({ ok: true, value: 'line1\nline2\tend' });
    expect(api.boundedText('x'.repeat(21), { max: 20 })).toEqual({ ok: false, reason: 'too_long' });
    expect(api.boundedText('   ', { max: 20, min: 1 })).toEqual({ ok: false, reason: 'too_short' });
    expect(api.boundedText('', { max: 20 })).toEqual({ ok: true, value: '' });
    for (const bad of [null, undefined, 42, {}, ['a']]) {
      expect(api.boundedText(bad, { max: 20 })).toEqual({ ok: false, reason: 'type' });
    }
  });
});

describe('parseModelJson', () => {
  const schema: Schema = {
    type: 'object',
    fields: {
      headline: { type: 'string', max: 50 },
      kpis: { type: 'array', items: { type: 'string', max: 30 }, max: 3 },
      score: { type: 'number', min: 0, max: 100 },
      live: { type: 'boolean' },
      platforms: {
        type: 'record',
        keys: ['twitter', 'telegram'],
        values: { type: 'object', fields: { post: { type: 'string', max: 100 } } },
      },
    },
    optional: ['score', 'live'],
  };
  const good = { headline: 'عنوان', kpis: ['a', 'b'], platforms: { twitter: { post: 'hi' } } };

  it('parses plain and fenced JSON', () => {
    expect(api.parseModelJson(JSON.stringify(good), schema)).toEqual({ ok: true, value: good });
    expect(api.parseModelJson('```json\n' + JSON.stringify(good) + '\n```', schema)).toEqual({ ok: true, value: good });
    expect(api.parseModelJson('  ```\n' + JSON.stringify(good) + '\n```  ', schema)).toEqual({ ok: true, value: good });
    expect(api.parseModelJson(JSON.stringify({ ...good, score: 7, live: true }), schema)).toEqual({ ok: true, value: { ...good, score: 7, live: true } });
  });

  it('drops unknown keys instead of passing them through', () => {
    const result = api.parseModelJson<Record<string, unknown>>(JSON.stringify({ ...good, extra: 'x', platforms: { twitter: { post: 'hi', html: '<b>' } } }), schema);
    expect(result).toEqual({ ok: true, value: good });
  });

  it('never throws and explains failures', () => {
    const failures = [
      'not json at all',
      '',
      '[]',
      'null',
      JSON.stringify({ ...good, headline: 'x'.repeat(51) }),
      JSON.stringify({ ...good, headline: 5 }),
      JSON.stringify({ ...good, kpis: ['a', 'b', 'c', 'd'] }),
      JSON.stringify({ ...good, kpis: 'abc' }),
      JSON.stringify({ ...good, score: 101 }),
      JSON.stringify({ ...good, score: '7' }),
      JSON.stringify({ ...good, live: 'yes' }),
      JSON.stringify({ kpis: [], platforms: {} }), // missing required headline
      JSON.stringify({ ...good, platforms: { facebook: { post: 'hi' } } }), // key outside the allowlist
      JSON.stringify({ ...good, platforms: [] }),
    ];
    for (const text of failures) {
      const result = api.parseModelJson(text, schema);
      expect(result.ok, text.slice(0, 60)).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('is immune to prototype pollution', () => {
    const evil = '{"headline":"x","kpis":[],"platforms":{},"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}';
    const result = api.parseModelJson<Record<string, unknown>>(evil, schema);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value).sort()).toEqual(['headline', 'kpis', 'platforms']);
      expect((result.value as { polluted?: unknown }).polluted).toBeUndefined();
    }
    const nested: Schema = { type: 'record', keys: ['__proto__', 'a'], values: { type: 'string', max: 5 } };
    const r2 = api.parseModelJson<Record<string, unknown>>('{"__proto__":"x","a":"y"}', nested);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    if (r2.ok) expect(Object.getPrototypeOf(r2.value) === Object.prototype || Object.getPrototypeOf(r2.value) === null).toBe(true);
  });
});
