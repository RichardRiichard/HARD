// Garante que o service worker guarda todos os arquivos do app para uso offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DOCS = new URL('../docs/', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [relative(DOCS, full).split(sep).join('/')];
  });
}

const sw = readFileSync(join(DOCS, 'sw.js'), 'utf8');
const precache = [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const lazy = [...sw.match(/const LAZY = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('todo arquivo do app está na lista de cache offline', () => {
  const files = walk(DOCS).filter((f) => f !== 'sw.js' && !/\.(md|txt)$/.test(f));
  const missing = files.filter((f) => !precache.includes(f) && !lazy.includes(f));
  assert.deepEqual(missing, [], `Adicione ao PRECACHE em docs/sw.js: ${missing.join(', ')}`);
});

test('todo item da lista de cache existe', () => {
  const ghost = [...precache, ...lazy].filter((f) => f !== './' && !existsSync(join(DOCS, f)));
  assert.deepEqual(ghost, [], `Arquivos inexistentes no PRECACHE: ${ghost.join(', ')}`);
});

test('versão do app igual no service worker e nas configurações', () => {
  const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
  const settings = readFileSync(join(DOCS, 'js/ui/views/settings.js'), 'utf8');
  const appVersion = settings.match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(swVersion, appVersion);
});
