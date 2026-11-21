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

Evaluation is live (debounced), runs entirely client-side, and the address bar
always carries the current input + expressions (deflate-compressed in the hash),
so any state can be shared with **Copy link**. The **Sample** menu loads
examples taken from the engine's own test suites.

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
