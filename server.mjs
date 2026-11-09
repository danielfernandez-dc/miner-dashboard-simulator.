// Local preview only. Vercel serves public/ directly.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/simulator.mjs': ['simulator.mjs', 'text/javascript'],
  '/style.css': ['style.css', 'text/css'],
  '/raw-log.html': ['raw-log.html', 'text/html'],
  '/raw-log.js': ['raw-log.js', 'text/javascript'],
  '/miner-error-rules.json': ['miner-error-rules.json', 'application/json'],
};
const server = http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end('Not found'); }
  try {
    const content = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(500); res.end('Unable to read file'); }
});
server.listen(Number(process.env.PORT || 8080), '127.0.0.1', () => console.log(`Miner simulator: http://localhost:${server.address().port}`));
