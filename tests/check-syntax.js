// Dev utility: extracts the inline <script> from index.html and syntax-checks
// it (plus logic.js) without executing. Run: node tests/check-syntax.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('No inline script found'); process.exit(1); }
try {
  new Function(m[1]);
  console.log('index.html inline script: syntax OK');
} catch (e) {
  console.error('index.html inline script: SYNTAX ERROR —', e.message);
  process.exit(1);
}
try {
  require(path.join(root, 'logic.js'));
  console.log('logic.js: loads OK');
} catch (e) {
  console.error('logic.js: ERROR —', e.message);
  process.exit(1);
}
