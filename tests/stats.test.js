import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totalMinutes,
  totalPages,
  minutesByType,
  minutesThisWeek,
  byWeek,
  byMonth,
  pace,
  topItems,
  topSources,
  entriesInPeriod,
  completedSummary,
  completedByMonth,
} from '../docs/js/core/stats.js';
import { toLocalDate } from '../docs/js/core/dates.js';

const e = (date, minutes, extra = {}) => ({ id: `${date}-${minutes}`, itemId: 'b', date, minutes, pages: null, ...extra });

test('total é a soma das entradas', () => {
  const entries = [e('2026-10-01', 45), e('2026-10-02', 1.5), e('2026-10-03', 10.2)];
  assert.equal(totalMinutes(entries), 56.7);
  assert.equal(totalMinutes([]), 0);
  assert.equal(totalPages([e('x', 1, { pages: 10 }), e('y', 1, { pages: 5 }), e('z', 1)]), 15);
});

test('minutos por tipo', () => {
  const items = new Map([
    ['l', { type: 'livro' }],
    ['a', { type: 'artigo' }],
    ['b', { type: 'blog' }],
  ]);
  const entries = [e('2026-10-01', 30, { itemId: 'l' }), e('2026-10-01', 5, { itemId: 'a' }), e('2026-10-02', 8, { itemId: 'b' }), e('2026-10-03', 15, { itemId: 'l' })];
  assert.deepEqual(minutesByType(entries, items), { livro: 45, artigo: 5, blog: 8 });
});

test('semana atual vai de segunda a domingo', () => {
  const entries = [
    e('2026-10-11', 100), // domingo da semana anterior
    e('2026-10-12', 10), // segunda
    e('2026-10-15', 20), // quinta
    e('2026-10-18', 30), // domingo
    e('2026-10-19', 1000), // próxima segunda
  ];
  assert.equal(minutesThisWeek(entries, '2026-10-15'), 60);
  assert.equal(minutesThisWeek(entries, '2026-10-18'), 60);
});

test('soma por semana preenche semanas vazias e ordena da mais antiga', () => {
  const entries = [e('2026-10-13', 10, { pages: 4 }), e('2026-10-15', 5), e('2026-09-29', 7), e('2026-01-01', 999)];
  const weeks = byWeek(entries, '2026-10-15', 4);
  assert.deepEqual(
    weeks.map((w) => [w.key, w.minutes]),
    [
      ['2026-09-21', 0],
      ['2026-09-28', 7],
      ['2026-10-05', 0],
      ['2026-10-12', 15],
    ],
  );
  assert.equal(weeks[3].pages, 4);
  assert.equal(weeks[3].count, 2);
});

test('soma por mês atravessa a virada do ano', () => {
  const entries = [e('2025-12-31', 20), e('2026-01-01', 30), e('2026-02-15', 5, { pages: 3 }), e('2026-02-28', 5, { pages: 2 })];
  const months = byMonth(entries, '2026-02-10', 3);
  assert.deepEqual(
    months.map((m) => [m.key, m.minutes, m.pages]),
    [
      ['2025-12', 20, 0],
      ['2026-01', 30, 0],
      ['2026-02', 10, 5],
    ],
  );
});

test('leitura às 23h em São Paulo conta no dia certo (não no dia seguinte em UTC)', () => {
  // 23:30 de domingo (18/10) em SP = 02:30 de segunda (19/10) em UTC.
  const date = toLocalDate(new Date('2026-10-19T02:30:00Z'));
  assert.equal(date, '2026-10-18');
  const entries = [e(date, 25)];
  assert.equal(minutesThisWeek(entries, '2026-10-15'), 25);
  assert.equal(byWeek(entries, '2026-10-19', 2)[0].minutes, 25);
});

test('ritmo: média diária dos últimos 30 dias e comparação com os 30 anteriores', () => {
  const entries = [
    e('2026-10-15', 60), // hoje
    e('2026-09-16', 30), // 1º dia da janela atual (15/10 - 29)
    e('2026-09-15', 45), // último dia da janela anterior
    e('2026-08-17', 15), // 1º dia da janela anterior
    e('2026-08-16', 999), // fora das duas janelas
  ];
  const p = pace(entries, '2026-10-15', 30);
  assert.equal(p.total, 90);
  assert.equal(p.perDay, 3);
  assert.equal(p.previousTotal, 60);
  assert.equal(p.previousPerDay, 2);
  assert.equal(p.changePct, 50);
  assert.equal(pace([e('2026-10-15', 10)], '2026-10-15').changePct, null);
});

test('onde foi seu tempo: leituras, autores e sites com mais minutos', () => {
  const items = new Map([
    ['l1', { id: 'l1', type: 'livro', title: 'Livro A', author: 'C. S. Lewis' }],
    ['l2', { id: 'l2', type: 'livro', title: 'Livro B', author: 'c. s. lewis' }],
    ['a1', { id: 'a1', type: 'blog', title: 'Post', site: 'Substack X' }],
    ['a2', { id: 'a2', type: 'artigo', title: 'Sem site', site: '' }],
  ]);
  const entries = [
    e('2026-10-01', 30, { itemId: 'l1' }),
    e('2026-10-02', 20, { itemId: 'l1' }),
    e('2026-10-02', 40, { itemId: 'l2' }),
    e('2026-10-03', 70, { itemId: 'a1' }),
    e('2026-10-03', 5, { itemId: 'a2' }),
    e('2026-10-03', 5, { itemId: 'apagado' }),
  ];
  assert.deepEqual(
    topItems(entries, items, 2).map((r) => [r.label, r.minutes]),
    [['Post', 70], ['Livro A', 50]],
  );
  // Autores: maiúsculas diferentes contam como o mesmo; 2 livros.
  assert.deepEqual(
    topSources(entries, items, 'autor').map((r) => [r.label, r.minutes, r.items]),
    [['C. S. Lewis', 90, 2]],
  );
  assert.deepEqual(
    topSources(entries, items, 'site').map((r) => [r.label, r.minutes, r.items]),
    [['Substack X', 70, 1]],
  );
});

test('período das estatísticas: 30 dias, ano e sempre', () => {
  const entries = [e('2026-10-15', 1), e('2026-09-16', 2), e('2026-09-15', 4), e('2025-12-31', 8)];
  const sum = (list) => list.reduce((s, x) => s + x.minutes, 0);
  assert.equal(sum(entriesInPeriod(entries, '30d', '2026-10-15')), 3);
  assert.equal(sum(entriesInPeriod(entries, 'ano', '2026-10-15')), 7);
  assert.equal(sum(entriesInPeriod(entries, 'sempre', '2026-10-15')), 15);
});

test('concluídos por período', () => {
  const items = [
    { type: 'livro', status: 'lido', finishedOn: '2026-10-13' },
    { type: 'livro', status: 'lido', finishedOn: '2026-09-02' },
    { type: 'artigo', status: 'lido', finishedOn: '2026-10-15' },
    { type: 'blog', status: 'lido', finishedOn: '2025-12-30' },
    { type: 'livro', status: 'lendo', finishedOn: null },
    { type: 'artigo', status: 'quero', finishedOn: null },
  ];
  const s = completedSummary(items, '2026-10-15');
  assert.deepEqual(s.semana, { livros: 1, artigos: 1 });
  assert.deepEqual(s.mes, { livros: 1, artigos: 1 });
  assert.deepEqual(s.ano, { livros: 2, artigos: 1 });
  assert.deepEqual(s.total, { livros: 2, artigos: 2 });
  const months = completedByMonth(items, '2026-10-15', 2);
  assert.deepEqual(months, [
    { key: '2026-09', livros: 1, artigos: 0 },
    { key: '2026-10', livros: 1, artigos: 1 },
  ]);
});
