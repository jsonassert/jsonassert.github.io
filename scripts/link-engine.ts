// Links node_modules/@jsonassert/jsonassert-js to the resolved engine source
// (JSONASSERT_JS_DIR or the workspace sibling), so bun, tsc and editors all
// resolve the package the same way. Re-run whenever JSONASSERT_JS_DIR changes;
// every package.json script does it first.
import { lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ENGINE_PACKAGE, ROOT, engineDir, engineEntry } from './engine';

export function linkEngine(): string {
  engineEntry(); // fails fast with a helpful message when the checkout is missing
  const target = engineDir();
  const link = resolve(ROOT, 'node_modules', ENGINE_PACKAGE);
  mkdirSync(dirname(link), { recursive: true });
  let current: string | null = null;
  try {
    if (lstatSync(link).isSymbolicLink()) current = readlinkSync(link);
    else rmSync(link, { recursive: true, force: true });
  } catch {
    current = null;
  }
  if (current !== target) {
    if (current !== null) rmSync(link, { force: true });
    symlinkSync(target, link, 'dir');
  }
  return target;
}

if (import.meta.main) {
  console.log(`engine linked: ${ENGINE_PACKAGE} -> ${linkEngine()}`);
}
