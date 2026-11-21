// Non-UI evaluation logic: splits the expression editor into lines and runs
// each one through the jsonassert engine, producing display-ready results.
import { JsonataError, evaluate, evaluateAssertion, parseAssert, render, OPERATORS } from '@jsonassert/jsonassert-js';
import type { Node, Operator } from '@jsonassert/jsonassert-js';

export type LineStatus = 'pass' | 'fail' | 'value' | 'error';

export interface LineError {
  code: string;
  message: string;
  /** Absolute character offset inside the editor document, when known. */
  from: number | null;
}

export interface LineResult {
  /** 1-based line number in the expression editor. */
  line: number;
  source: string;
  kind: 'assert' | 'expression';
  status: LineStatus;
  operator?: Operator;
  actual?: unknown;
  expected?: unknown;
  /** Plain-expression result. */
  value?: unknown;
  jsonata?: string;
  error?: LineError;
}

export interface RunSummary {
  results: LineResult[];
  passed: number;
  failed: number;
  errors: number;
}

/** Lines starting with `//` (after whitespace) are comments; the engine has no comment syntax. */
export function isComment(text: string): boolean {
  return text.trimStart().startsWith('//');
}

export function isAssertLine(text: string): boolean {
  return /^assert(\s|$)/.test(text.trim());
}

const POSITION_SUFFIX = / \(at position -?\d+\)$/;

function errorOf(err: unknown, from: number | null): LineError {
  if (err instanceof JsonataError) {
    return { code: err.code, message: err.message.replace(POSITION_SUFFIX, ''), from };
  }
  return { code: 'ERROR', message: err instanceof Error ? err.message : String(err), from: null };
}

/**
 * Mirror of the engine's top-level operator scan. The engine reports parse
 * errors relative to the side (left/right of the assert operator) that failed,
 * so the playground needs the side offsets to place the error in the line.
 */
export function splitAssert(text: string): { leftStart: number; rightStart: number } | null {
  const trimmedStart = text.length - text.trimStart().length;
  const body = text.trim();
  const restRaw = body.slice(6);
  const rest = restRaw.trim();
  const restOffset = 6 + (restRaw.length - restRaw.trimStart().length);
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const c = rest.charAt(i);
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '"' || c === "'") quote = c;
    else if (depth === 0) {
      const op = OPERATORS.find((o) => rest.startsWith(o, i));
      if (op) {
        const right = rest.slice(i + op.length);
        const rightStart = i + op.length + (right.length - right.trimStart().length);
        return { leftStart: trimmedStart + restOffset, rightStart: trimmedStart + restOffset + rightStart };
      }
    }
  }
  return null;
}

/** Parses a standalone expression by wrapping it as the left side of a throwaway assert. */
export function parseExpression(text: string): Node {
  const statement = parseAssert(`assert (${text}) == null`);
  const left = statement.left;
  return left.kind === 'group' ? left.inner : left;
}

function exprErrorOffset(err: unknown, text: string): number | null {
  if (!(err instanceof JsonataError) || err.position < 0) return null;
  // position is relative to "(text)"
  return Math.max(0, Math.min(text.length, err.position - 1));
}

function runAssert(text: string, input: unknown, lineStart: number): Omit<LineResult, 'line' | 'source'> {
  try {
    const r = evaluateAssertion(text, input);
    return {
      kind: 'assert',
      status: r.passed ? 'pass' : 'fail',
      operator: r.operator,
      actual: r.actual,
      expected: r.expected,
      jsonata: r.jsonata
    };
  } catch (err) {
    let jsonata: string | undefined;
    try {
      jsonata = parseAssert(text).toJsnata();
    } catch {
      jsonata = undefined;
    }
    return { kind: 'assert', status: 'error', jsonata, error: errorOf(err, assertErrorOffset(err, text, lineStart)) };
  }
}

function assertErrorOffset(err: unknown, text: string, lineStart: number): number | null {
  if (!(err instanceof JsonataError) || err.position < 0) return null;
  const lead = text.length - text.trimStart().length;
  if (err.code === 'INVALID_ASSERTION') return lineStart + lead + err.position;
  const split = splitAssert(text);
  if (!split) return lineStart + lead + err.position;
  // Decide which side failed: re-parse the left side alone.
  const left = text.slice(split.leftStart).slice(0, split.rightStart - split.leftStart);
  const leftExpr = left.replace(/(==|!=|>=|<=|>|<)\s*$/, '').trimEnd();
  let leftFailed = false;
  try {
    parseExpression(leftExpr);
  } catch {
    leftFailed = true;
  }
  return lineStart + (leftFailed ? split.leftStart : split.rightStart) + err.position;
}

function runExpression(text: string, input: unknown, lineStart: number): Omit<LineResult, 'line' | 'source'> {
  const lead = text.length - text.trimStart().length;
  const body = text.trim();
  let node: Node;
  try {
    node = parseExpression(body);
  } catch (err) {
    const off = exprErrorOffset(err, body);
    return { kind: 'expression', status: 'error', error: errorOf(err, off === null ? null : lineStart + lead + off) };
  }
  const jsonata = render(node);
  try {
    const value = evaluate(node, input ?? {});
    return { kind: 'expression', status: 'value', value: value === undefined ? null : value, jsonata };
  } catch (err) {
    return { kind: 'expression', status: 'error', jsonata, error: errorOf(err, null) };
  }
}

/** Runs every non-empty, non-comment line of the expression document. */
export function run(source: string, input: unknown): RunSummary {
  const results: LineResult[] = [];
  let offset = 0;
  source.split('\n').forEach((raw, index) => {
    const lineStart = offset;
    offset += raw.length + 1;
    const text = raw.replace(/\r$/, '');
    if (!text.trim() || isComment(text)) return;
    const partial = isAssertLine(text) ? runAssert(text, input, lineStart) : runExpression(text, input, lineStart);
    results.push({ line: index + 1, source: text.trim(), ...partial });
  });
  return {
    results,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    errors: results.filter((r) => r.status === 'error').length
  };
}

export interface JsonParse {
  value: unknown;
  error: { message: string; from: number | null } | null;
}

/** Parses the JSON input pane. Empty input evaluates against `{}`, like the engine default. */
export function parseJson(text: string): JsonParse {
  if (!text.trim()) return { value: undefined, error: null };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { value: undefined, error: { message, from: jsonErrorOffset(message, text) } };
  }
}

/** Extracts an offset from engine-specific JSON.parse messages (V8, SpiderMonkey, JSC). */
export function jsonErrorOffset(message: string, text: string): number | null {
  const pos = /position (\d+)/.exec(message);
  if (pos) return Number(pos[1]);
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) {
    const lines = text.split('\n');
    const line = Number(lc[1]) - 1;
    let off = 0;
    for (let i = 0; i < line && i < lines.length; i++) off += lines[i]!.length + 1;
    return off + Number(lc[2]) - 1;
  }
  if (/end of (data|input)|Unexpected EOF/i.test(message)) return text.length;
  return null;
}

/** Compact JSON rendering for result values. */
export function show(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}
