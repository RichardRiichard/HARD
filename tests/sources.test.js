import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeResults, fromBrasilApi, asIsbn } from '../docs/js/services/books-api.js';
import { parsePostUrl, titleFromSlug, firstUrl, fromSubstackPost } from '../docs/js/services/link-info.js';

const book = (o) => ({ title: '', author: '', totalPages: null, coverUrl: '', isbn: '', year: null, publisher: '', source: 'x', ...o });

test('mescla fontes: remove repetidos e completa páginas/capa', () => {
  const brasil = [book({ title: 'O Peregrino', author: 'John Bunyan', isbn: '9788573257', totalPages: 320, source: 'brasilapi' })];
  const google = [
    book({ title: 'O peregrino: edição especial', author: 'John Bunyan', coverUrl: 'https://g/x.jpg', source: 'google' }),
    book({ title: 'Outro livro', author: 'Fulano', source: 'google' }),
  ];
  const ol = [book({ title: 'O Peregrino', author: 'Bunyan', isbn: '9788573257', coverUrl: 'https://ol/1.jpg', source: 'openlibrary' })];
  const merged = mergeResults([brasil, google, ol]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].source, 'brasilapi');
  assert.equal(merged[0].totalPages, 320);
  assert.equal(merged[0].coverUrl, 'https://g/x.jpg');
  assert.equal(merged[1].title, 'Outro livro');
  assert.equal(merged[1].coverUrl, ''); // sem ISBN, sem capa de reserva
  const onlyIsbn = mergeResults([[book({ title: 'Sem capa', isbn: '9780000000002' })]]);
  assert.match(onlyIsbn[0].coverUrl, /covers\.openlibrary\.org\/b\/isbn\/9780000000002-M\.jpg/);
});

test('BrasilAPI: converte campos e força https na capa', () => {
  const b = fromBrasilApi({ isbn: '9788543105758', title: 'Livro', subtitle: 'Sub', authors: ['A', 'B'], page_count: 200, cover_url: 'http://x/c.jpg', year: 2019, publisher: 'Ed' });
  assert.deepEqual([b.title, b.author, b.totalPages, b.coverUrl, b.source], ['Livro: Sub', 'A, B', 200, 'https://x/c.jpg', 'brasilapi']);
  assert.equal(asIsbn('978-85-431-0575-8'), '9788543105758');
  assert.equal(asIsbn('O Peregrino'), null);
});

test('links do Substack: publicação, slug e título provisório', () => {
  const p = parsePostUrl('https://fulano.substack.com/p/o-poder-da-oracao?utm_source=app');
  assert.equal(p.publication, 'fulano');
  assert.equal(p.slug, 'o-poder-da-oracao');
  assert.equal(p.isSubstack, true);
  assert.equal(titleFromSlug(p.slug), 'O poder da oracao');
  const custom = parsePostUrl('https://www.meublog.com/p/meu-post');
  assert.equal(custom.slug, 'meu-post');
  assert.equal(custom.publication, null);
  assert.equal(parsePostUrl('não é link'), null);
  assert.equal(parsePostUrl('https://site.com/artigo').slug, null);
});

test('compartilhar: acha o link dentro do texto', () => {
  assert.equal(firstUrl('Leia isto: https://x.substack.com/p/abc. Muito bom!'), 'https://x.substack.com/p/abc');
  assert.equal(firstUrl('sem link'), '');
});

test('resposta da API de post do Substack', () => {
  const r = fromSubstackPost({
    title: ' Título ',
    wordcount: 2150,
    publishedBylines: [{ name: 'Ana' }, { name: 'Bia' }],
    post_date: '2026-10-16T01:30:00.000Z', // 22:30 do dia 15 em São Paulo
    cover_image: 'https://substackcdn.com/image/x.jpg',
  });
  assert.deepEqual(r, { title: 'Título', author: 'Ana, Bia', words: 2150, publishedOn: '2026-10-15', coverUrl: 'https://substackcdn.com/image/x.jpg' });
  const empty = fromSubstackPost({ title: 'x', cover_image: 'javascript:alert(1)' });
  assert.equal(empty.words, null);
  assert.equal(empty.publishedOn, null);
  assert.equal(empty.coverUrl, '');
});
