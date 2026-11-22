import { describe, expect, test } from 'bun:test';
import { decodeShare, decodeState, defaultShare, encodeSample, encodeState, sampleFor, shareQuery } from './share';
import { SAMPLES, sampleJson } from './samples';

describe('shareable URL', () => {
  test('encodes custom state as readable query params', () => {
    const query = encodeState({ json: '{"a": 1}', expr: 'assert a == 1' });
    expect(query).toBe('expr=assert%20a%20%3D%3D%201&json=%7B%22a%22%3A%201%7D');
    expect(query).not.toContain('#');
    expect(query).not.toMatch(/[A-Za-z0-9_-]{60,}/);
  });

  test('encodes a sample as its slug', () => {
    expect(encodeSample('higher-order')).toBe('s=higher-order');
    for (const s of SAMPLES) expect(shareQuery({ json: sampleJson(s), expr: s.expr })).toBe(`s=${s.id}`);
  });

  test('round-trips every sample, as slug and as custom state', () => {
    for (const s of SAMPLES) {
      const state = { json: sampleJson(s), expr: s.expr };
      expect(decodeState(`?s=${s.id}`)).toEqual(state);
      expect(decodeState(encodeSample(s.id))).toEqual(state);
      expect(decodeState(`?${encodeState(state)}`)).toEqual(state);
      expect(decodeState(encodeState(state))).toEqual(state);
      expect(decodeShare(`?s=${s.id}`).sampleId).toBe(s.id);
    }
  });

  test('round-trips unicode, separators and control characters', () => {
    const state = {
      json: '{"nome": "ação ✓ \\"x\\"","q": "a&b=c+d 100%","lista": [1, 2.5, null]}',
      expr: "assert nome == 'ação ✓'\nassert q == 'a&b=c+d 100%'\n\n// s=not-a-slug & expr=x"
    };
    expect(decodeState(encodeState(state))).toEqual(state);
    expect(decodeState(`?${encodeState(state)}`)).toEqual(state);
  });

  test('round-trips empty and very large content', () => {
    const empty = { json: '', expr: '' };
    expect(decodeState(encodeState(empty))).toEqual(empty);

    const big = {
      json: JSON.stringify({ rows: Array.from({ length: 400 }, (_, i) => ({ id: i, nome: `item ${i} & ✓` })) }, null, 2),
      expr: 'assert $count(rows) == 400'
    };
    const query = encodeState(big);
    expect(query.length).toBeGreaterThan(big.json.length);
    expect(query).toContain('item%200');
    expect(decodeState(query)).toEqual(big);
  });

  test('keeps content that matches no sample in the query', () => {
    const state = { json: '{"a": 1}', expr: 'assert a == 1' };
    expect(sampleFor(state)).toBeUndefined();
    expect(shareQuery(state)).toBe(encodeState(state));
    expect(decodeShare(`?${shareQuery(state)}`)).toEqual({ state, sampleId: '' });
  });

  test('accepts a single custom param and a typed "+" as space', () => {
    expect(decodeState('?expr=assert%20a')).toEqual({ json: '', expr: 'assert a' });
    expect(decodeState('?json=%7B%7D')).toEqual({ json: '{}', expr: '' });
    expect(decodeState('?expr=assert+a+b')).toEqual({ json: '', expr: 'assert a b' });
  });

  test('decodes the browser-normalized spelling of the same query', () => {
    const state = { json: '{"a": 1}', expr: "assert a == 'x'" };
    expect(decodeState(encodeState(state))).toEqual(state);
    expect(decodeState('?expr=assert%20a%20%3D%3D%20%27x%27&json=%7B%22a%22%3A%201%7D')).toEqual(state);
  });

  test('rejects absent params, unknown slugs and malformed escaping', () => {
    for (const search of ['', '?', '?foo=bar', '?s=nope', '?s=', '?s=INVOICE', '?expr=%zz', '?expr=%E0%A4%A', '?json=%C3']) {
      expect(decodeState(search)).toBeNull();
      expect(decodeShare(search)).toEqual(defaultShare());
    }
  });

  test('falls back to the sample content when an unknown slug comes with custom params', () => {
    const state = { json: '{}', expr: 'assert 1 == 1' };
    expect(decodeState(`?s=nope&${encodeState(state)}`)).toEqual(state);
  });

  test('never produces a hash-based URL', () => {
    for (const s of SAMPLES) {
      const state = { json: sampleJson(s), expr: s.expr };
      expect(shareQuery(state)).not.toContain('#');
      expect(decodeState(`#s=${s.id}`)).toBeNull();
    }
  });
});
