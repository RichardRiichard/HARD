import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, parseBackup, entriesToCsv } from '../docs/js/core/transfer.js';

const items = [
  { id: 'b1', type: 'livro', title: 'O Peregrino', author: 'John Bunyan', status: 'lendo' },
  { id: 'a1', type: 'artigo', title: 'Fé; razão e "ciência"', site: 'exemplo.com', status: 'lido' },
];
const entries = [
  { id: 'e2', itemId: 'a1', date: '2026-10-15', createdAt: '2026-10-15T12:00:00Z', pages: null, pageFrom: null, pageTo: null, minutes: 12 },
  { id: 'e1', itemId: 'b1', date: '2026-10-14', createdAt: '2026-10-14T12:00:00Z', pages: 30, pageFrom: 0, pageTo: 30, minutes: 45 },
  { id: 'e3', itemId: 'b1', date: '2026-10-15', createdAt: '2026-10-15T13:00:00Z', pages: 3, pageFrom: 30, pageTo: 33, minutes: 4.5 },
];

test('exporta e reimporta sem perdas', () => {
  const now = new Date('2026-10-15T18:00:00Z');
  const exported = buildExport({ items, entries, settings: { minPerPage: 2 }, dataUpdatedAt: '2026-10-15T17:00:00.000Z' }, now);
  const r = parseBackup(JSON.stringify(exported));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.items, items);
  assert.deepEqual(r.data.entries, entries);
  assert.deepEqual(r.data.settings, { minPerPage: 2 });
  assert.equal(r.data.dataUpdatedAt, '2026-10-15T17:00:00.000Z');
});

test('rejeita arquivos que não são backup válido', () => {
  assert.equal(parseBackup('não é json').ok, false);
  assert.equal(parseBackup({ app: 'outro', schema: 1, items: [], entries: [] }).ok, false);
  assert.equal(parseBackup({ app: 'leituras', schema: 99, items: [], entries: [] }).ok, false);
  assert.equal(parseBackup({ app: 'leituras', schema: 1, items: [] }).ok, false);
  assert.equal(parseBackup({ app: 'leituras', schema: 1, items: [{ id: 'x', type: 'filme', status: 'lido' }], entries: [] }).ok, false);
  const badEntry = { app: 'leituras', schema: 1, items, entries: [{ id: 'e', itemId: 'b1', date: '15/10/2026', minutes: 1 }] };
  assert.equal(parseBackup(badEntry).ok, false);
});

test('descarta registros sem item', () => {
  const r = parseBackup({ app: 'leituras', schema: 1, items, entries: [...entries, { ...entries[0], id: 'orfa', itemId: 'sumiu' }] });
  assert.equal(r.ok, true);
  assert.equal(r.data.entries.length, 3);
});

test('CSV em ordem cronológica, com ";" e vírgula decimal e campos escapados', () => {
  const csv = entriesToCsv(entries, new Map(items.map((i) => [i.id, i])));
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Data;Tipo;Título;Autor/Site;Página inicial;Página final;Páginas;Minutos');
  assert.equal(lines[1], '14/10/2026;Livro;O Peregrino;John Bunyan;0;30;30;45');
  assert.equal(lines[2], '15/10/2026;Artigo;"Fé; razão e ""ciência""";exemplo.com;;;;12');
  assert.equal(lines[3], '15/10/2026;Livro;O Peregrino;John Bunyan;30;33;3;4,5');
});

test('carimbo de alteração é sempre crescente (relógios diferentes entre aparelhos)', async () => {
  // store.js importa o IndexedDB só quando usado; nextStamp é pura.
  const { nextStamp } = await import('../docs/js/data/store.js');
  const now = Date.parse('2026-10-15T12:00:00.000Z');
  assert.equal(nextStamp(null, now), '2026-10-15T12:00:00.000Z');
  assert.equal(nextStamp('2026-10-15T11:00:00.000Z', now), '2026-10-15T12:00:00.000Z');
  // Backup veio de um aparelho com relógio 1 h adiantado:
  assert.equal(nextStamp('2026-10-15T13:00:00.000Z', now), '2026-10-15T13:00:00.001Z');
});
