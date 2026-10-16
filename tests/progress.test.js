import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBook,
  createArticle,
  applyProgress,
  correctCurrentPage,
  markArticleRead,
  itemAfterEntryDeleted,
  applyEntryEdit,
  setStatus,
} from '../docs/js/core/progress.js';
import { DEFAULT_SETTINGS } from '../docs/js/core/calc.js';

const settings = DEFAULT_SETTINGS;
const now = new Date('2026-10-15T15:00:00Z');

function book(extra = {}) {
  return { ...createBook({ title: 'Livro', author: 'A', totalPages: 300 }, now), ...extra };
}

test('progresso: calcula páginas desde o último registro', () => {
  const b = book({ currentPage: 40, status: 'lendo', startedOn: '2026-10-01' });
  const r = applyProgress(b, 70, { date: '2026-10-15', settings, now });
  assert.equal(r.ok, true);
  assert.equal(r.entry.pages, 30);
  assert.equal(r.entry.pageFrom, 40);
  assert.equal(r.entry.pageTo, 70);
  assert.equal(r.entry.minutes, 45);
  assert.equal(r.entry.date, '2026-10-15');
  assert.equal(r.item.currentPage, 70);
  assert.equal(r.item.status, 'lendo');
  assert.equal(r.item.startedOn, '2026-10-01');
});

test('progresso: primeiro registro muda "quero ler" para "lendo"', () => {
  const r = applyProgress(book(), 10, { date: '2026-10-15', settings, now });
  assert.equal(r.item.status, 'lendo');
  assert.equal(r.item.startedOn, '2026-10-15');
  assert.equal(r.entry.minutes, 15);
});

test('progresso: usa o min/página do livro quando definido', () => {
  const r = applyProgress(book({ minPerPage: 3 }), 10, { date: '2026-10-15', settings, now });
  assert.equal(r.entry.minutes, 30);
});

test('progresso: "terminei" completa até a última página', () => {
  const b = book({ currentPage: 250, status: 'lendo' });
  const r = applyProgress(b, b.totalPages, { date: '2026-10-15', settings, now });
  assert.equal(r.entry.pages, 50);
  assert.equal(r.entry.minutes, 75);
  assert.equal(r.item.status, 'lido');
  assert.equal(r.item.finishedOn, '2026-10-15');
});

test('progresso: rejeita página menor, igual, acima do total ou inválida', () => {
  const b = book({ currentPage: 100 });
  const opts = { date: '2026-10-15', settings, now };
  assert.equal(applyProgress(b, 90, opts).reason, 'backwards');
  assert.equal(applyProgress(b, 100, opts).reason, 'same');
  assert.equal(applyProgress(b, 301, opts).reason, 'beyond');
  assert.equal(applyProgress(b, 10.5, opts).reason, 'invalid');
  assert.equal(applyProgress(b, -1, opts).reason, 'invalid');
});

test('corrigir página atual não gera leitura e reabre livro concluído', () => {
  const b = book({ currentPage: 300, status: 'lido', finishedOn: '2026-10-10' });
  const fixed = correctCurrentPage(b, 120, now);
  assert.equal(fixed.currentPage, 120);
  assert.equal(fixed.status, 'lendo');
  assert.equal(fixed.finishedOn, null);
  assert.equal(correctCurrentPage(b, 999, now).currentPage, 300);
});

test('artigo: marcar como lido gera entrada com o tempo do artigo', () => {
  const a = createArticle({ title: 'Post', minutes: 12, type: 'blog' }, now);
  const { item, entry } = markArticleRead(a, { date: '2026-10-14', now });
  assert.equal(item.status, 'lido');
  assert.equal(item.finishedOn, '2026-10-14');
  assert.equal(entry.minutes, 12);
  assert.equal(entry.pages, null);
  assert.equal(entry.itemId, a.id);
});

test('apagar a última entrada de um livro volta a página atual', () => {
  const b = book({ currentPage: 300, status: 'lido', finishedOn: '2026-10-15' });
  const entry = { pageFrom: 250, pageTo: 300, pages: 50 };
  const reverted = itemAfterEntryDeleted(b, entry, [], now);
  assert.equal(reverted.currentPage, 250);
  assert.equal(reverted.status, 'lendo');
  assert.equal(reverted.finishedOn, null);
  // Entrada antiga (não é a última): nada muda.
  assert.equal(itemAfterEntryDeleted(b, { pageFrom: 10, pageTo: 50 }, [], now), null);
});

test('apagar a única entrada de um artigo volta para "quero ler"', () => {
  const a = { ...createArticle({ title: 'A', minutes: 5 }, now), status: 'lido', finishedOn: '2026-10-15' };
  assert.equal(itemAfterEntryDeleted(a, {}, [], now).status, 'quero');
  assert.equal(itemAfterEntryDeleted(a, {}, [{ id: 'outra' }], now), null);
});

test('editar entrada de livro: páginas movem pageTo e a página atual', () => {
  const b = book({ currentPage: 70, status: 'lendo' });
  const entry = { id: 'e1', itemId: b.id, date: '2026-10-15', pageFrom: 40, pageTo: 70, pages: 30, minutes: 45 };
  const r = applyEntryEdit(entry, { date: '2026-10-10', pages: 20, minutes: 30 }, b, now);
  assert.equal(r.ok, true);
  assert.equal(r.entry.date, '2026-10-10');
  assert.equal(r.entry.pageTo, 60);
  assert.equal(r.entry.minutes, 30);
  assert.equal(r.item.currentPage, 60);
  assert.equal(applyEntryEdit(entry, { pages: 999, minutes: 1 }, b, now).reason, 'beyond');
  assert.equal(applyEntryEdit(entry, { pages: 10, minutes: -1 }, b, now).reason, 'invalid');
});

test('editar só os minutos não mexe no livro', () => {
  const b = book({ currentPage: 70 });
  const entry = { id: 'e1', date: '2026-10-15', pageFrom: 40, pageTo: 70, pages: 30, minutes: 45 };
  const r = applyEntryEdit(entry, { pages: 30, minutes: 60 }, b, now);
  assert.equal(r.entry.minutes, 60);
  assert.equal(r.item, null);
});

test('status manual: "lido" define data de conclusão; outros limpam', () => {
  const a = createArticle({ title: 'A', minutes: 5 }, now);
  const lido = setStatus(a, 'lido', { date: '2026-10-15', now });
  assert.equal(lido.finishedOn, '2026-10-15');
  assert.equal(setStatus(lido, 'abandonado', { date: '2026-10-16', now }).finishedOn, null);
});

test('artigo medido em páginas: a entrada leva as páginas', () => {
  const a = createArticle({ title: 'PDF', minutes: 18, timeMode: 'paginas', pageCount: 12 }, now);
  assert.equal(a.pageCount, 12);
  const { entry } = markArticleRead(a, { date: '2026-10-15', now });
  assert.equal(entry.pages, 12);
  assert.equal(entry.minutes, 18);
  // Outros modos não levam páginas.
  const b = createArticle({ title: 'Post', minutes: 5, timeMode: 'manual', pageCount: 12 }, now);
  assert.equal(b.pageCount, null);
  assert.equal(markArticleRead(b, { date: '2026-10-15', now }).entry.pages, null);
});
