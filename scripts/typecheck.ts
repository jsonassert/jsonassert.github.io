// Links the engine, then type-checks the app (engine source included).
import { linkEngine } from './link-engine';

const engine = linkEngine();
const proc = Bun.spawnSync(['bunx', 'tsc', '--noEmit', '-p', 'tsconfig.json'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdout: 'inherit',
  stderr: 'inherit'
});
if (proc.exitCode === 0) console.log(`typecheck ok (engine: ${engine})`);
process.exit(proc.exitCode ?? 1);
