// Copies the web app's source files into ./www, the directory Capacitor
// bundles into the native iOS/Android projects (see capacitor.config.json
// webDir). The repo root stays the single source of truth — edit index.html /
// logic.js / icons.js as before, then `npm run sync:web` (or cap:sync) to
// refresh the native payload. www/ is generated and git-ignored.
import { mkdirSync, copyFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

// Files copied verbatim into www/. Add new top-level web assets here.
const FILES = ['index.html', 'logic.js', 'icons.js'];
// Whole directories copied if present (e.g. bundled fonts/images later).
const DIRS = ['assets'];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const f of FILES) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error(`sync-web: missing required file ${f}`);
  copyFileSync(src, join(www, f));
}
for (const d of DIRS) {
  const src = join(root, d);
  if (existsSync(src)) cpSync(src, join(www, d), { recursive: true });
}

console.log(`sync-web: copied ${FILES.length} file(s) into www/`);
