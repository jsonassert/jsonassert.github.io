// Shareable state as ordinary query parameters, readable in the address bar:
// `?s=<sample-slug>` for a built-in sample, `?expr=<assert lines>&json=<input>`
// (percent-encoded) for custom content.

import { DEFAULT_SAMPLE, SAMPLES, sampleBySlug, sampleJson, type Sample } from './samples';

export interface ShareState {
  json: string;
  expr: string;
}

export interface DecodedShare {
  state: ShareState;
  sampleId: string;
}

const SAMPLE_PARAM = 's';
const EXPR_PARAM = 'expr';
const JSON_PARAM = 'json';

function sampleState(sample: Sample): ShareState {
  return { json: sampleJson(sample), expr: sample.expr };
}

export function defaultShare(): DecodedShare {
  return { state: sampleState(DEFAULT_SAMPLE), sampleId: DEFAULT_SAMPLE.id };
}

/** The built-in sample holding exactly this content, when there is one. */
export function sampleFor(state: ShareState): Sample | undefined {
  return SAMPLES.find((s) => s.expr === state.expr && sampleJson(s) === state.json);
}

export function encodeSample(slug: string): string {
  return `${SAMPLE_PARAM}=${encodeURIComponent(slug)}`;
}

export function encodeState(state: ShareState): string {
  return `${EXPR_PARAM}=${encodeURIComponent(state.expr)}&${JSON_PARAM}=${encodeURIComponent(state.json)}`;
}

/** Query string for the address bar; sample content keeps its short slug form. */
export function shareQuery(state: ShareState): string {
  const sample = sampleFor(state);
  return sample ? encodeSample(sample.id) : encodeState(state);
}

/**
 * Strict decode of a search string, with or without the leading '?'.
 * Returns null when the relevant params are absent or malformed.
 */
export function decodeState(search: string): ShareState | null {
  let params: Map<string, string>;
  try {
    params = parseQuery(search.startsWith('?') ? search.slice(1) : search);
  } catch {
    return null;
  }
  const slug = params.get(SAMPLE_PARAM);
  if (slug) {
    const sample = sampleBySlug(slug);
    if (sample) return sampleState(sample);
  }
  const expr = params.get(EXPR_PARAM);
  const json = params.get(JSON_PARAM);
  if (expr === undefined && json === undefined) return null;
  return { json: json ?? '', expr: expr ?? '' };
}

/** Decode for the UI: the state plus the matching sample selection, defaulting to the first sample. */
export function decodeShare(search: string): DecodedShare {
  const state = decodeState(search);
  if (!state) return defaultShare();
  return { state, sampleId: sampleFor(state)?.id ?? '' };
}

function parseQuery(query: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of query.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? '' : part.slice(eq + 1);
    params.set(decodeParam(key), decodeParam(value));
  }
  return params;
}

/** Percent-decodes a query component ('+' stands for a space, as in a typed URL); throws when malformed. */
function decodeParam(text: string): string {
  return decodeURIComponent(text.replace(/\+/g, ' '));
}
