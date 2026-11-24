// vite-plugin-singlefile emits index.html; SPEC §2.1 requires dist-single/sys-viz.html.
import { existsSync, renameSync, rmSync } from 'node:fs';

const from = new URL('../dist-single/index.html', import.meta.url);
const to = new URL('../dist-single/sys-viz.html', import.meta.url);

if (!existsSync(from)) {
  console.error('dist-single/index.html not found; did the single build run?');
  process.exit(1);
}
if (existsSync(to)) rmSync(to);
renameSync(from, to);
console.log('dist-single/sys-viz.html ready');
