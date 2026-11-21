// Resolves where the jsonassert TypeScript engine source lives.
// Default: the sibling checkout inside the testframe workspace
// (modules/jsonassert/modules/jsonassert-js). Override with JSONASSERT_JS_DIR.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE_PACKAGE = '@jsonassert/jsonassert-js';
export const DEFAULT_ENGINE_DIR = '../jsonassert/modules/jsonassert-js';

export function engineDir(): string {
  return resolve(ROOT, process.env.JSONASSERT_JS_DIR || DEFAULT_ENGINE_DIR);
}

export function engineEntry(): string {
  const entry = resolve(engineDir(), 'src/index.ts');
  if (!existsSync(entry)) {
    throw new Error(
      `jsonassert engine not found at ${entry}. ` +
        'Check out jsonassert/jsonassert-lang and set JSONASSERT_JS_DIR to its modules/jsonassert-js directory.'
    );
  }
  return entry;
}

export function engineVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(engineDir(), 'package.json'), 'utf8')) as { version?: string };
  return pkg.version ?? 'unknown';
}
