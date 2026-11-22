import { useCallback, useEffect, useMemo, useState } from 'react';
import { Editor, type EditorProblem } from './editor';
import { parseJson, run, show, type LineResult } from './runner';
import { SAMPLES, sampleBySlug } from './samples';
import { decodeShare, encodeSample, shareQuery, type ShareState } from './share';

const ENGINE_REPO = 'https://github.com/jsonassert/jsonassert-lang';
const JSONATA_DOCS = 'https://docs.jsonata.org/';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const STATUS_LABEL: Record<LineResult['status'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  value: 'VALUE',
  error: 'ERROR'
};

function ResultCard({ r, onJump }: { r: LineResult; onJump: (line: number) => void }) {
  return (
    <li className={`result result-${r.status}`}>
      <div className="result-head">
        <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
        <button type="button" className="line-link" onClick={() => onJump(r.line)} title="Line in the expression editor">
          line {r.line}
        </button>
        <code className="result-source">{r.source}</code>
      </div>
      {r.kind === 'assert' && r.status !== 'error' && (
        <div className="sides">
          <div className="side">
            <span className="side-label">left</span>
            <code>{show(r.actual)}</code>
          </div>
          <span className="side-op">{r.operator}</span>
          <div className="side">
            <span className="side-label">right</span>
            <code>{show(r.expected)}</code>
          </div>
        </div>
      )}
      {r.status === 'value' && (
        <pre className="value">{JSON.stringify(r.value, null, 2) ?? 'undefined'}</pre>
      )}
      {r.error && (
        <div className="error">
          <span className="error-code">{r.error.code}</span> {r.error.message}
          {r.error.from !== null && <span className="error-pos"> (offset {r.error.from})</span>}
        </div>
      )}
      {r.jsonata && (
        <div className="canonical">
          <span className="side-label">JSONata</span>
          <code>{r.jsonata}</code>
        </div>
      )}
    </li>
  );
}

/** Absolute URL of the address bar; the browser normalizes the query (a `'` becomes `%27`). */
function shareUrl(state: ShareState): URL {
  return new URL(`${window.location.pathname}?${shareQuery(state)}`, window.location.origin);
}

export function App() {
  const [initial] = useState(() => decodeShare(window.location.search));
  const [json, setJson] = useState(initial.state.json);
  const [expr, setExpr] = useState(initial.state.expr);
  const [sampleId, setSampleId] = useState(initial.sampleId);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  // The address bar is the source of truth: back/forward and hand-edited URLs reload the editors.
  const applyUrl = useCallback(() => {
    const share = decodeShare(window.location.search);
    setJson(share.state.json);
    setExpr(share.state.expr);
    setSampleId(share.sampleId);
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', applyUrl);
    return () => window.removeEventListener('popstate', applyUrl);
  }, [applyUrl]);

  const djson = useDebounced(json, 250);
  const dexpr = useDebounced(expr, 250);

  const parsed = useMemo(() => parseJson(djson), [djson]);
  const summary = useMemo(() => (parsed.error ? null : run(dexpr, parsed.value)), [parsed, dexpr]);

  const jsonProblems = useMemo<EditorProblem[]>(
    () => (parsed.error ? [{ from: parsed.error.from ?? 0, message: parsed.error.message }] : []),
    [parsed]
  );
  const exprProblems = useMemo<EditorProblem[]>(() => {
    if (!summary) return [];
    const lineStarts: number[] = [0];
    for (let i = 0; i < dexpr.length; i++) if (dexpr[i] === '\n') lineStarts.push(i + 1);
    return summary.results
      .filter((r) => r.error)
      .map((r) => {
        const start = lineStarts[r.line - 1] ?? 0;
        const end = (lineStarts[r.line] ?? dexpr.length + 1) - 1;
        const from = r.error!.from ?? start;
        return { from, to: r.error!.from === null ? end : undefined, message: `${r.error!.code}: ${r.error!.message}` };
      });
  }, [summary, dexpr]);

  // Keep the address bar in sync while typing, without adding history entries.
  useEffect(() => {
    const url = shareUrl({ json: djson, expr: dexpr });
    if (window.location.href !== url.href) history.replaceState(history.state, '', url);
  }, [djson, dexpr]);

  const loadSample = (slug: string) => {
    const sample = sampleBySlug(slug);
    if (!sample) return;
    history.pushState(null, '', `?${encodeSample(sample.id)}`);
    applyUrl();
  };

  const copyLink = async () => {
    try {
      const url = shareUrl({ json, expr });
      history.replaceState(history.state, '', url);
      await navigator.clipboard.writeText(url.href);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied('idle'), 1800);
  };

  const jumpToLine = (line: number) => {
    const el = document.querySelectorAll('.pane-expr .cm-line')[line - 1];
    el?.scrollIntoView({ block: 'center' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            {'{'}<span className="logo-check">✓</span>{'}'}
          </span>
          <span className="brand-name">jsonassert</span>
          <span className="brand-tag">playground</span>
          <span className="version" title="Engine version (@jsonassert/jsonassert-js)">engine v{__ENGINE_VERSION__}</span>
        </div>
        <div className="controls">
          <label className="sample-select">
            <span>Sample</span>
            <select value={sampleId} onChange={(e) => loadSample(e.target.value)}>
              {sampleId === '' && <option value="">Custom</option>}
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => void copyLink()}>
            {copied === 'ok' ? 'Link copied' : copied === 'fail' ? 'Copy failed' : 'Copy link'}
          </button>
          <nav className="links">
            <a href={ENGINE_REPO} target="_blank" rel="noreferrer">jsonassert-lang</a>
            <a href={JSONATA_DOCS} target="_blank" rel="noreferrer">JSONata docs</a>
          </nav>
        </div>
      </header>

      <main className="workspace">
        <section className="pane pane-json" aria-label="JSON input">
          <div className="pane-title">
            <span>Input JSON</span>
            {parsed.error ? <span className="pill pill-error">invalid JSON</span> : <span className="pill">valid</span>}
          </div>
          <div className="pane-body">
            <Editor value={json} onChange={setJson} language="json" problems={jsonProblems} label="JSON input" placeholder="Paste a JSON document (empty = {})" />
          </div>
          {parsed.error && <div className="pane-footer error">{parsed.error.message}</div>}
        </section>

        <section className="pane pane-expr" aria-label="Assertions">
          <div className="pane-title">
            <span>Assertions</span>
            <span className="hint">one per line &middot; <code>assert &lt;expr&gt; == &lt;expr&gt;</code> &middot; plain lines show their value &middot; <code>//</code> comments</span>
          </div>
          <div className="pane-body">
            <Editor value={expr} onChange={setExpr} language="jsonassert" problems={exprProblems} label="jsonassert expressions" placeholder="assert $count(items) > 0" />
          </div>
        </section>

        <section className="pane pane-result" aria-label="Results" aria-live="polite">
          <div className="pane-title">
            <span>Results</span>
            {summary && (
              <span className="totals">
                <span className="t-pass">{summary.passed} passed</span>
                <span className="t-fail">{summary.failed} failed</span>
                <span className="t-error">{summary.errors} errors</span>
              </span>
            )}
          </div>
          <div className="pane-body results">
            {!summary && <p className="empty">Fix the JSON input to evaluate the assertions.</p>}
            {summary && summary.results.length === 0 && <p className="empty">Type an <code>assert</code> line to see results.</p>}
            {summary && summary.results.length > 0 && (
              <ul>
                {summary.results.map((r) => (
                  <ResultCard key={`${r.line}:${r.source}`} r={r} onJump={jumpToLine} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <footer className="footer">
        Runs entirely in your browser. jsonassert is a JSONata-based assertion language; the JSONata column shows each line's canonical equivalent.
      </footer>
    </div>
  );
}
