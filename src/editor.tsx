// Thin React wrapper around CodeMirror 6 with external diagnostics.
import { useEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, StreamLanguage, foldGutter, type StringStream } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { setDiagnostics, lintGutter, type Diagnostic } from '@codemirror/lint';
import { tags as t } from '@lezer/highlight';

export interface EditorProblem {
  from: number;
  to?: number;
  message: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  language: 'json' | 'jsonassert';
  problems: EditorProblem[];
  label: string;
  placeholder?: string;
}

const KEYWORDS = new Set([
  'assert', 'if', 'else', 'switch', 'case', 'default', 'for', 'in', 'while', 'function', 'and', 'or', 'not'
]);
const ATOMS = new Set(['true', 'false', 'null']);

interface TokenState {
  inString: string | null;
}

/**
 * Minimal stream tokenizer for the jsonassert language. CodeMirror calls it
 * unbound, so the string branch recurses by name instead of through `this`.
 */
function tokenize(stream: StringStream, state: TokenState): string | null {
  if (state.inString) {
    while (!stream.eol()) {
      const ch = stream.next();
      if (ch === '\\') stream.next();
      else if (ch === state.inString) { state.inString = null; break; }
    }
    return 'string';
  }
  if (stream.eatSpace()) return null;
  if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
  const ch = stream.peek();
  if (ch === '"' || ch === "'") { state.inString = stream.next() ?? null; return tokenize(stream, state); }
  if (ch === '`') { stream.next(); stream.skipTo('`') ? stream.next() : stream.skipToEnd(); return 'propertyName'; }
  if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return 'number';
  if (stream.match(/^\$[A-Za-z_][\w]*(?=\s*\()/)) return 'function';
  if (stream.match(/^\$[A-Za-z_]?\w*/)) return 'variableName';
  if (stream.match(/^[A-Za-z_][\w]*/)) {
    const word = stream.current();
    if (KEYWORDS.has(word)) return 'keyword';
    if (ATOMS.has(word)) return 'atom';
    return 'propertyName';
  }
  if (stream.match(/^(==|!=|>=|<=|[=<>+\-*/?:])/)) return 'operator';
  stream.next();
  return 'punctuation';
}

export const jsonassertLanguage = StreamLanguage.define<TokenState>({
  name: 'jsonassert',
  startState: () => ({ inString: null }),
  token: tokenize,
  languageData: { commentTokens: { line: '//' } }
});

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: t.string, color: 'var(--syn-string)' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: [t.bool, t.null, t.atom], color: 'var(--syn-atom)' },
  { tag: t.function(t.variableName), color: 'var(--syn-function)' },
  { tag: t.variableName, color: 'var(--syn-variable)' },
  { tag: t.propertyName, color: 'var(--syn-property)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.punctuation, color: 'var(--fg-muted)' }
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'var(--editor-bg)', color: 'var(--fg)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--editor-gutter)', color: 'var(--fg-subtle)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-selection) !important' },
  '.cm-matchingBracket': { backgroundColor: 'var(--editor-selection)', outline: 'none' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' },
  '.cm-placeholder': { color: 'var(--fg-subtle)' }
});

export function Editor({ value, onChange, language, problems, label, placeholder }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const extensions: Extension[] = [
      lineNumbers(),
      foldGutter(),
      lintGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      syntaxHighlighting(highlight),
      theme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': label }),
      language === 'json' ? json() : jsonassertLanguage,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current(u.state.doc.toString());
      })
    ];
    if (placeholder) extensions.push(placeholderExt(placeholder));
    view.current = new EditorView({ parent: host.current!, state: EditorState.create({ doc: value, extensions }) });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (samples, shared links).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const len = v.state.doc.length;
    const diagnostics: Diagnostic[] = problems.map((p) => {
      const from = Math.max(0, Math.min(p.from, len));
      let to = Math.min(p.to ?? from + 1, len);
      if (to <= from) to = Math.min(from + 1, len);
      return { from, to, severity: 'error', message: p.message };
    });
    v.dispatch(setDiagnostics(v.state, diagnostics));
  }, [problems, value]);

  return <div className="editor" ref={host} />;
}
