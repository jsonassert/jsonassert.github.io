# jsonassert playground

Try the [jsonassert](https://github.com/jsonassert/jsonassert-lang) assertion
language in the browser: https://jsonassert.github.io/

- **Input JSON** (left): the document the assertions run against; parse errors
  are underlined in place.
- **Assertions** (top right): one line per item. `assert <expr> (==|!=|>|>=|<|<=) <expr>`
  lines pass or fail; any other non-empty line is evaluated as a plain
  expression and its value is shown. Lines starting with `//` are comments.
- **Results** (bottom right): pass/fail per line with both evaluated sides,
  the canonical JSONata form of the line, and errors (code, message and the
  offending position underlined in the editor when the engine reports one).

Evaluation is live (debounced) and runs entirely client-side. The address bar
always carries the current content as plain, readable query parameters — no
compression, no base64 — so any state can be shared with **Copy link**:

- a built-in sample: `https://jsonassert.github.io/?s=control-flow`
- custom content: `https://jsonassert.github.io/?expr=assert%20a%20%3D%3D%201&json=%7B%22a%22%3A%201%7D`

The **Sample** menu loads examples taken from the engine's own test suites and
navigates to the sample's `?s=<slug>` URL; as soon as the content differs from
every sample the address bar switches to the explicit `expr` / `json` form.
Unknown or malformed parameters fall back to the default sample.

## Development

Requires [bun](https://bun.sh) and a checkout of
[`jsonassert/jsonassert-lang`](https://github.com/jsonassert/jsonassert-lang)
(the engine is consumed from source). Inside the testframe workspace the
sibling checkout is found automatically; elsewhere point `JSONASSERT_JS_DIR` at
its `modules/jsonassert-js` directory.

```bash
bun install
bun run dev        # http://localhost:5173
bun run verify     # typecheck + test + build
```

Deployed by GitHub Actions (`.github/workflows/pages.yml`) on every push to `main`.
