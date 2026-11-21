import { describe, expect, test } from 'bun:test';
import { SAMPLES, sampleJson } from './samples';
import { parseJson, run } from './runner';

describe('samples', () => {
  test('ids are unique and titles present', () => {
    const ids = SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SAMPLES) expect(s.title.length).toBeGreaterThan(0);
  });

  test('cover the documented feature set', () => {
    const all = SAMPLES.map((s) => s.expr).join('\n');
    for (const needle of ['$sum(', '$count(', '$map(', '$filter(', '$reduce(', '[Price > 20]', 'if (', 'switch (', 'for (']) {
      expect(all).toContain(needle);
    }
    expect(SAMPLES.some((s) => s.expected.includes('fail'))).toBe(true);
  });

  for (const sample of SAMPLES) {
    test(`${sample.id}: evaluates with the documented outcomes`, () => {
      const parsed = parseJson(sampleJson(sample));
      expect(parsed.error).toBeNull();
      const summary = run(sample.expr, parsed.value);
      const errors = summary.results.filter((r) => r.error);
      expect(errors).toEqual([]);
      expect(summary.results.map((r) => r.status)).toEqual(sample.expected);
      for (const r of summary.results) expect(r.jsonata?.length ?? 0).toBeGreaterThan(0);
    });
  }
});
