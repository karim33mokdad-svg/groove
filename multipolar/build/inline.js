/* Single-file build.
 *
 *   node build/inline.js
 *
 * Produces two artefacts in dist/:
 *
 *   multipolar.html     a complete standalone page — one file, no server, no
 *                       network. Open it from disk, email it, drop it on any
 *                       static host.
 *   multipolar.frag.html  the same page without the document shell, for hosts
 *                       that supply their own <!doctype>/<head>/<body>.
 *
 * The game has no build step for development; this exists only so the whole
 * thing can travel as a single file.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

/* A closing script tag inside inlined source would end the block early. */
const guard = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

/* stylesheet -> inline <style> */
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  '<style>\n' + read(href) + '\n</style>');

/* scripts -> inline <script> */
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  '<script>\n/* ' + src + ' */\n' + guard(read(src)) + '\n</script>');

/* nothing external survives: the manifest, icon and service worker are all
   separate files that a single-file build cannot carry */
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '')
  .replace(/\s*<link rel="icon"[^>]*>/g, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');
html = html.replace(
  /if \('serviceWorker' in navigator[\s\S]*?\n\s*\}\n/,
  '/* no service worker in the single-file build: there are no separate\n' +
  '       files to cache, and the page already works offline. */\n');

const left = html.match(/(src|href)="(?!data:)[^"]+"/g);
if (left) { console.error('external reference survived:', left.join(', ')); process.exit(1); }

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/multipolar.html'), html);

/* fragment: title + everything the host does not already provide */
const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'MULTIPOLAR';
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
const styles = (html.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
fs.writeFileSync(path.join(root, 'dist/multipolar.frag.html'),
  '<title>' + title + '</title>\n' + styles + '\n' + body.trim() + '\n');

const kb = f => (fs.statSync(path.join(root, f)).size / 1024).toFixed(0) + ' KB';
console.log('dist/multipolar.html      ' + kb('dist/multipolar.html') + '  (standalone)');
console.log('dist/multipolar.frag.html ' + kb('dist/multipolar.frag.html') + '  (fragment)');
