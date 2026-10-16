// Intermediário da Cloudflare (cloudflare/worker.js): só atende o app e só a API de posts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.js';

const APP = 'https://richardriichard.github.io';
const call = (target, origin = APP) =>
  worker.fetch(new Request(`https://proxy.workers.dev/?url=${encodeURIComponent(target)}`, { headers: origin ? { Origin: origin } : {} }));

test('repassa a API de post do Substack para o app, com CORS', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, 'https://x.substack.com/api/v1/posts/meu-post');
    return new Response(JSON.stringify({ title: 'Ok', wordcount: 10 }), { status: 200 });
  });
  const res = await call('https://x.substack.com/api/v1/posts/meu-post');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), APP);
  assert.equal((await res.json()).title, 'Ok');
});

test('recusa outros sites e outros endereços', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('não deveria buscar'));
  assert.equal((await call('https://x.substack.com/api/v1/posts/a', 'https://outro-site.com')).status, 403);
  assert.equal((await call('https://x.substack.com/api/v1/posts/a', '')).status, 403);
  assert.equal((await call('https://x.substack.com/api/v1/subscriptions')).status, 403);
  assert.equal((await call('http://x.substack.com/api/v1/posts/a')).status, 403);
  assert.equal((await call('https://intranet/admin')).status, 403);
});
