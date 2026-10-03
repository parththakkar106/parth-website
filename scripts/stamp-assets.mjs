// Browsers keep assets/ for up to 4 hours, so index.html points at each CSS/JS file with ?v=<content hash>.
// Run after changing site.css or site.js:  node scripts/stamp-assets.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const page = new URL('../public/index.html', import.meta.url);
let html = readFileSync(page, 'utf8');
for (const file of ['assets/css/site.css', 'assets/js/site.js']) {
  const hash = createHash('sha256').update(readFileSync(new URL('../public/' + file, import.meta.url))).digest('hex').slice(0, 10);
  const re = new RegExp(file.replace(/[.]/g, '\\.') + '(\\?v=[0-9a-f]+)?"', 'g');
  if (!re.test(html)) throw new Error(file + ' is not referenced in index.html');
  html = html.replace(re, file + '?v=' + hash + '"');
  console.log(file, hash);
}
writeFileSync(page, html);
