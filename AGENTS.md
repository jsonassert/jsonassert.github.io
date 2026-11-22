# AGENTS.md — jsonassert playground

Static single-page playground for the jsonassert assertion language, deployed
to GitHub Pages at https://jsonassert.github.io/ (org Pages site, served at the
domain root). Code, comments and docs in English.

## Stack

- Vite + React 18 + TypeScript, managed with **bun** (lockfile: `bun.lock`).
- CodeMirror 6 editors (`src/editor.tsx`): JSON mode for the input, a small
  stream tokenizer for jsonassert; diagnostics via `@codemirror/lint`.
- No backend: the engine runs in the browser.

## Layout

| Path | What it is |
|---|---|
| `src/runner.ts` | Non-UI logic: splits the expression document into lines, runs asserts / plain expressions, maps engine error positions to document offsets, parses the JSON input |
| `src/share.ts` | URL state: `?s=<sample-slug>` or `?expr=<text>&json=<text>` (percent-encoded query params) encode/decode |
| `src/samples.ts` | Sample datasets + expressions (from the engine tests) with the documented outcome per line |
| `src/App.tsx`, `src/editor.tsx`, `src/styles.css` | UI |
| `src/*.test.ts` | `bun test` suites for runner, share and samples (no UI tests) |
| `scripts/engine.ts` | Resolves the engine location / version |
| `scripts/link-engine.ts` | Symlinks `node_modules/@jsonassert/jsonassert-js` to the engine |
| `scripts/typecheck.ts` | link + `tsc --noEmit` |
| `.github/workflows/pages.yml` | CI + Pages deploy |

## Engine wiring

`@jsonassert/jsonassert-js` (repo `jsonassert/jsonassert-lang`, not published to
npm) is consumed **from source**. The location is
`${JSONASSERT_JS_DIR:-../jsonassert/modules/jsonassert-js}` (the default is the
sibling checkout inside the testframe workspace).

- `scripts/link-engine.ts` (run by `postinstall` and before every script)
  symlinks `node_modules/@jsonassert/jsonassert-js` to that directory, so bun
  and tsc resolve it like a normal package. tsc uses `customConditions: ["bun"]`
  to pick the package's `src/index.ts` export (no `dist/` needed).
- `vite.config.ts` aliases the package to `<engine>/src/index.ts` and injects
  `__ENGINE_VERSION__` from the engine's `package.json` (shown in the header).
- Never edit the engine here; engine changes go to `jsonassert-lang` (TS + Java twins).

## Commands

```bash
bun install
bun run dev         # dev server
bun run typecheck
bun run test        # bun test ./src
bun run build       # dist/ (base from PAGES_BASE, default '/')
bun run preview     # serve dist/
bun run verify      # typecheck + test + build
```

## Deploy

`.github/workflows/pages.yml`: on push to `main` (and on PRs, without deploy)
it checks out this repo into `site/` and `jsonassert/jsonassert-lang` into
`jsonassert-lang/`, sets `JSONASSERT_JS_DIR`, installs with
`--frozen-lockfile`, runs typecheck/test/build and deploys `dist/` with
`actions/upload-pages-artifact` + `actions/deploy-pages` (main only). Pages
must be configured with the "GitHub Actions" build type.

`base` is `/` (org site at the domain root); set `PAGES_BASE=/<path>/` to build
for a project Pages path instead.

## Conventions

- Beta: no backward-compat concerns (the shareable URL scheme may change).
- Sharing uses query parameters only (`?s=<slug>`, `?expr=…&json=…`, plain
  percent-encoding): Pages is static, so unknown path routes 404, and the
  shared state must stay readable in the address bar.
- Keep non-UI logic in plain modules with `bun test` coverage; samples must
  keep their `expected` outcomes in sync, and their `id`s double as the URL
  slugs, so they stay unique kebab-case (`src/samples.test.ts` enforces both).
- Original look: do not copy branding, styles or text from try.jsonata.org.
