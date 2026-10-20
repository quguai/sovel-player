import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, process.argv.includes('--dist') ? 'dist' : 'site');
const port = Number(process.env.PORT || 4788);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
const headerRules = [];
for (const line of (await readFile(resolve(root, '_headers'), 'utf8')).split('\n')) {
  if (line.startsWith('/')) headerRules.push({ path: line.trim(), headers: {} });
  else if (/^\s+\S/.test(line)) {
    const separator = line.indexOf(':');
    headerRules.at(-1).headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
}
http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  for (const rule of headerRules) {
    if (rule.path === '/*' || (rule.path.endsWith('*') && pathname.startsWith(rule.path.slice(0, -1))) || rule.path === pathname) {
      for (const [name, value] of Object.entries(rule.headers)) response.setHeader(name, value);
    }
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(403).end('Forbidden'); return; }
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep) || pathname === '/_headers') { response.writeHead(403).end('Forbidden'); return; }
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(await readFile(resolve(root, '404.html')));
  }
}).listen(port, '127.0.0.1', () => console.log(`Sovel HiFi website: http://localhost:${port}`));
