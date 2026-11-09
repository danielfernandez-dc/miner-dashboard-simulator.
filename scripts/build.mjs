import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
for (const name of ['index.html', 'style.css', 'app.js', 'simulator.mjs', 'raw-log.html', 'raw-log.js']) {
  const path = new URL(`public/${name}`, root);
  await access(path);
  if (/\.(js|mjs)$/.test(name)) execFileSync(process.execPath, ['--check', fileURLToPath(path)], { stdio: 'inherit' });
}
JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
JSON.parse(await readFile(new URL('public/miner-error-rules.json', root), 'utf8'));
console.log('Static site checked. Deployable output: public/');
