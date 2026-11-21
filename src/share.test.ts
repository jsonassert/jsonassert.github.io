import { describe, expect, test } from 'bun:test';
import { decodeState, encodeState } from './share';
import { SAMPLES, sampleJson } from './samples';

describe('URL state', () => {
  test('round-trips every sample', async () => {
    for (const s of SAMPLES) {
      const state = { json: sampleJson(s), expr: s.expr };
      const hash = await encodeState(state);
      expect(hash).toMatch(/^s=[A-Za-z0-9_-]+$/);
      expect(await decodeState(`#${hash}`)).toEqual(state);
      expect(await decodeState(hash)).toEqual(state);
    }
  });

  test('round-trips unicode, quotes and empty strings', async () => {
    const state = { json: '{"nome": "ação ✓ \\"x\\""}', expr: "assert nome == 'ação ✓'\n\n// ok" };
    expect(await decodeState(await encodeState(state))).toEqual(state);
    const empty = { json: '', expr: '' };
    expect(await decodeState(await encodeState(empty))).toEqual(empty);
  });

  test('compresses large inputs', async () => {
    const json = sampleJson(SAMPLES[0]!);
    const hash = await encodeState({ json, expr: SAMPLES[0]!.expr });
    expect(hash.length).toBeLessThan(json.length);
  });

  test('rejects absent or malformed hashes', async () => {
    expect(await decodeState('')).toBeNull();
    expect(await decodeState('#other=1')).toBeNull();
    expect(await decodeState('#s=not-valid-deflate')).toBeNull();
  });
});
