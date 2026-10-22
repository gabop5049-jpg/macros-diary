// Builds dist/ with only the files the phone loads, and stamps a fresh CACHE_VERSION into sw.js
// so every deploy is picked up as an update. Usage: node build.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

// An allowlist, not a denylist: a new file (notes, .env, test data) is never shipped by accident.
const FILES = ['index.html', 'app.js', 'calc.js', 'backup.js', 'manifest.webmanifest', 'icon.svg',
  'icon-192.png', 'icon-512.png', '_headers', 'vendor/zxing-browser.min.js', 'vendor/zxing-browser.LICENSE'];

rmSync('dist', { recursive: true, force: true });
for (const f of FILES) { mkdirSync(`dist/${f}`.replace(/\/[^/]+$/, ''), { recursive: true }); cpSync(f, `dist/${f}`); }

let hash = 'nogit';
try { hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* not a git checkout */ }
const version = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${hash}`;
const sw = readFileSync('sw.js', 'utf8');
const stamped = sw.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${version}';`);
if (stamped === sw) throw new Error('CACHE_VERSION line not found in sw.js');
writeFileSync('dist/sw.js', stamped);

// Every file the service worker precaches must be in dist/, or installing it fails on the phone.
const precached = JSON.parse(sw.match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
for (const f of precached) if (f !== './' && !existsSync(`dist/${f}`)) throw new Error(`sw.js precaches ${f}, which is not in dist/`);

console.log(`Built dist/ (CACHE_VERSION ${version})`);
