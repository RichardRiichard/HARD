import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookMinutes,
  countWords,
  wordsToMinutes,
  sizeMinutes,
  effectiveMinPerPage,
  parseDecimal,
  formatDuration,
  displayMinutes,
  normalizeSettings,
  formatDecimal,
  DEFAULT_SETTINGS,
} from '../docs/js/core/calc.js';

test('tempo por páginas: páginas × min/página', () => {
  assert.equal(bookMinutes(30, 1.5), 45);
  assert.equal(bookMinutes(1, 1.5), 1.5);
  assert.equal(bookMinutes(7, 2.2), 15.4); // sem ruído de ponto flutuante
  assert.equal(bookMinutes(0, 1.5), 0);
  assert.equal(bookMinutes(-5, 1.5), 0);
  assert.equal(bookMinutes(10, 0), 0);
});

test('min/página: o do livro tem prioridade sobre o padrão', () => {
  const settings = { ...DEFAULT_SETTINGS, minPerPage: 1.5 };
  assert.equal(effectiveMinPerPage({ minPerPage: 3 }, settings), 3);
  assert.equal(effectiveMinPerPage({ minPerPage: null }, settings), 1.5);
  assert.equal(effectiveMinPerPage({}, settings), 1.5);
  assert.equal(effectiveMinPerPage({ minPerPage: 0 }, settings), 1.5);
  assert.equal(bookMinutes(20, effectiveMinPerPage({ minPerPage: 2.5 }, settings)), 50);
});

test('contagem de palavras ignora pontuação solta e espaços extras', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords(null), 0);
  assert.equal(countWords('Olá, mundo!'), 2);
  assert.equal(countWords('  muitos   espaços\n\ne linhas\t'), 4);
  assert.equal(countWords('guarda-chuva — é uma palavra só'), 5);
  assert.equal(countWords('São 3 itens: maçã, pão e café.'), 7);
  assert.equal(countWords('— – … !!'), 0);
});

test('tempo por palavras: palavras ÷ palavras por minuto', () => {
  assert.equal(wordsToMinutes(2200, 220), 10);
  assert.equal(wordsToMinutes(1000, 220), 5); // 4,5 -> 5
  assert.equal(wordsToMinutes(50, 220), 1); // texto curto conta 1 min
  assert.equal(wordsToMinutes(0, 220), 0);
  assert.equal(wordsToMinutes(3000, 300), 10);
  const text = Array.from({ length: 660 }, () => 'palavra').join(' ');
  assert.equal(wordsToMinutes(countWords(text), 220), 3);
});

test('tamanhos rápidos com valores ajustáveis', () => {
  assert.equal(sizeMinutes('curto'), 5);
  assert.equal(sizeMinutes('medio'), 10);
  assert.equal(sizeMinutes('longo'), 20);
  assert.equal(sizeMinutes('muitoLongo'), 35);
  assert.equal(sizeMinutes('longo', { longo: 25 }), 25);
  assert.equal(sizeMinutes('inexistente'), 0);
});

test('parseDecimal aceita vírgula e ponto', () => {
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal('1.5'), 1.5);
  assert.equal(parseDecimal(' 2 '), 2);
  assert.ok(Number.isNaN(parseDecimal('abc')));
  assert.ok(Number.isNaN(parseDecimal('')));
});

test('formatação de duração', () => {
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(125), '2 h 5 min');
  assert.equal(formatDuration(44.6), '45 min');
  assert.equal(displayMinutes(0.4), 1);
  assert.equal(displayMinutes(0), 0);
  assert.equal(displayMinutes(44.5), 45);
  assert.equal(formatDecimal(1.5), '1,5');
  assert.equal(formatDecimal(2), '2');
  assert.equal(formatDecimal(1.25), '1,25');
});

test('normalizeSettings corrige valores inválidos', () => {
  const s = normalizeSettings({ minPerPage: '2,5', wpm: -1, sizes: { curto: 7, longo: 'x' } });
  assert.equal(s.minPerPage, 2.5);
  assert.equal(s.wpm, 220);
  assert.deepEqual(s.sizes, { curto: 7, medio: 10, longo: 20, muitoLongo: 35 });
  assert.deepEqual(normalizeSettings(undefined), {
    minPerPage: 1.5,
    wpm: 220,
    sizes: { curto: 5, medio: 10, longo: 20, muitoLongo: 35 },
  });
});
