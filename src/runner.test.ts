import { describe, expect, test } from 'bun:test';
import { jsonErrorOffset, parseJson, run, splitAssert } from './runner';

describe('runner', () => {
  test('pass / fail / value / comments', () => {
    const s = run('// comment\nassert a == 1\n\nassert a > 5\na + 1', { a: 1 });
    expect(s.results.map((r) => [r.line, r.status])).toEqual([[2, 'pass'], [4, 'fail'], [5, 'value']]);
    expect(s.results[1]!.actual).toBe(1);
    expect(s.results[1]!.expected).toBe(5);
    expect(s.results[2]!.value).toBe(2);
    expect(s.results[0]!.jsonata).toBe('a = 1');
    expect(s).toMatchObject({ passed: 1, failed: 1, errors: 0 });
  });

  test('parse errors are mapped to absolute document offsets', () => {
    const doc = 'assert a == 1\nassert 1 == a +* 2';
    const err = run(doc, {}).results[1]!.error!;
    expect(err.code).toBe('PARSE_ERROR');
    expect(doc.charAt(err.from!)).toBe('*');
    expect(err.message).not.toContain('at position');

    const left = 'assert a +* 2 == 1';
    expect(left.charAt(run(left, {}).results[0]!.error!.from!)).toBe('*');

    const expr = '  a +* 2';
    expect(expr.charAt(run(expr, {}).results[0]!.error!.from!)).toBe('*');
  });

  test('invalid assertion and evaluation errors', () => {
    const r = run('assert 1 = 1\nassert $nope(1) == 1', {}).results;
    expect(r[0]!.error!.code).toBe('INVALID_ASSERTION');
    expect(r[1]!.error!.code).toBe('UNKNOWN_FUNCTION');
    expect(r[1]!.error!.from).toBeNull();
    expect(r[1]!.jsonata).toBe('$nope(1) = 1');
  });

  test('splitAssert finds side offsets', () => {
    const line = '  assert  (a == b)  !=  c';
    const s = splitAssert(line)!;
    expect(line.slice(s.leftStart)).toStartWith('(a == b)');
    expect(line.slice(s.rightStart)).toBe('c');
  });

  test('JSON input errors', () => {
    expect(parseJson('').value).toBeUndefined();
    expect(parseJson('{"a": 1}').value).toEqual({ a: 1 });
    expect(parseJson('{"a": }').error).not.toBeNull();
    expect(jsonErrorOffset('Unexpected token } in JSON at position 6', '{"a": }')).toBe(6);
    expect(jsonErrorOffset('JSON.parse: unexpected character at line 2 column 3 of the JSON data', '{\n  x}')).toBe(4);
  });
});
