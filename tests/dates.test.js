import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalDate,
  addDays,
  weekStart,
  weekdayIndex,
  addMonths,
  isValidDate,
  formatDay,
  formatDayRelative,
  formatMonthShort,
} from '../docs/js/core/dates.js';

test('toLocalDate usa o fuso de São Paulo (UTC-3), não o UTC', () => {
  // 02:30 UTC do dia 16 ainda é 23:30 do dia 15 em São Paulo.
  assert.equal(toLocalDate(new Date('2026-10-16T02:30:00Z')), '2026-10-15');
  assert.equal(toLocalDate(new Date('2026-10-16T03:00:00Z')), '2026-10-16');
  // Virada de ano
  assert.equal(toLocalDate(new Date('2027-01-01T02:59:59Z')), '2026-12-31');
});

test('toLocalDate respeita o horário de verão histórico (2018, UTC-2)', () => {
  // Em 2018-12-01 São Paulo estava em UTC-2: 01:30 UTC = 23:30 do dia anterior.
  assert.equal(toLocalDate(new Date('2018-12-02T01:30:00Z')), '2018-12-01');
  assert.equal(toLocalDate(new Date('2018-12-02T02:00:00Z')), '2018-12-02');
});

test('toLocalDate não depende do fuso do aparelho', () => {
  const instant = new Date('2026-03-01T01:00:00Z');
  assert.equal(toLocalDate(instant), '2026-02-28');
  assert.equal(toLocalDate(instant, 'Asia/Tokyo'), '2026-03-01');
});

test('addDays atravessa meses, anos e ano bissexto', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('semana começa na segunda-feira', () => {
  assert.equal(weekdayIndex('2026-10-12'), 0); // segunda
  assert.equal(weekdayIndex('2026-10-18'), 6); // domingo
  assert.equal(weekStart('2026-10-15'), '2026-10-12'); // quinta -> segunda
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // domingo pertence à semana anterior
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.equal(weekStart('2027-01-01'), '2026-12-28'); // semana atravessando o ano
});

test('addMonths', () => {
  assert.equal(addMonths('2026-10', 1), '2026-11');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-10', -12), '2025-10');
});

test('isValidDate', () => {
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-2-3'), false);
  assert.equal(isValidDate(''), false);
  assert.equal(isValidDate(undefined), false);
});

test('formatação em português', () => {
  assert.equal(formatDay('2026-10-15', '2026-10-20'), 'qui, 15 de out');
  assert.equal(formatDay('2025-12-25', '2026-10-20'), 'qui, 25 de dez de 2025');
  assert.equal(formatDayRelative('2026-10-15', '2026-10-15'), 'Hoje');
  assert.equal(formatDayRelative('2026-10-14', '2026-10-15'), 'Ontem');
  assert.equal(formatMonthShort('2026-03'), 'mar/26');
});
