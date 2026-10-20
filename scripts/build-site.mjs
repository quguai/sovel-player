import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'dist');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['index.html', 'site.css', 'story.css', 'site.js', 'story.js', 'copy.js', 'github.js', '404.html', '_headers', 'robots.txt', 'site.webmanifest', 'assets']) {
  await cp(resolve(root, 'site', name), resolve(destination, name), { recursive: true });
}
if (process.env.SITE_URL) {
  const url = new URL(process.env.SITE_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('SITE_URL must be a public HTTPS origin.');
  const base = url.origin;
  const html = (await readFile(resolve(destination, 'index.html'), 'utf8'))
    .replace('content="/assets/icon.png"', `content="${base}/assets/icon.png"`)
    .replace('</head>', `  <link rel="canonical" href="${base}/" />\n</head>`);
  await writeFile(resolve(destination, 'index.html'), html);
  await writeFile(resolve(destination, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>\n`);
  await writeFile(resolve(destination, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
}
console.log('Sovel HiFi website built → dist/ (Cloudflare Pages ready)');
