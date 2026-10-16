// Agregações para a tela inicial e estatísticas. Funções puras (tests/stats.test.js).
// Entradas têm date 'AAAA-MM-DD' (já no fuso de São Paulo), então somas por
// semana/mês não dependem do fuso do aparelho.

import { addDays, addMonths, dayNumber, monthKey, weekStart, yearKey } from './dates.js';
import { round1 } from './calc.js';

export function totalMinutes(entries) {
  return round1(entries.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0));
}

export function totalPages(entries) {
  return entries.reduce((sum, e) => sum + (Number(e.pages) || 0), 0);
}

/** Minutos por tipo de item: { livro, artigo, blog } */
export function minutesByType(entries, itemsById) {
  const out = { livro: 0, artigo: 0, blog: 0 };
  for (const e of entries) {
    const type = itemsById.get(e.itemId)?.type;
    if (type in out) out[type] += Number(e.minutes) || 0;
  }
  for (const k of Object.keys(out)) out[k] = round1(out[k]);
  return out;
}

/** Minutos lidos na semana (segunda a domingo) que contém `today`. */
export function minutesThisWeek(entries, today) {
  const start = weekStart(today);
  const end = addDays(start, 6);
  return totalMinutes(entries.filter((e) => e.date >= start && e.date <= end));
}

function bucketize(entries, keyOf, keys) {
  const map = new Map(keys.map((k) => [k, { key: k, minutes: 0, pages: 0, count: 0 }]));
  for (const e of entries) {
    const bucket = map.get(keyOf(e.date));
    if (!bucket) continue;
    bucket.minutes += Number(e.minutes) || 0;
    bucket.pages += Number(e.pages) || 0;
    bucket.count += 1;
  }
  return keys.map((k) => {
    const b = map.get(k);
    return { ...b, minutes: round1(b.minutes) };
  });
}

/** Últimas `count` semanas (inclui a atual), da mais antiga para a mais recente. key = segunda-feira. */
export function byWeek(entries, today, count = 12) {
  const current = weekStart(today);
  const keys = Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
  return bucketize(entries, weekStart, keys);
}

/** Últimos `count` meses (inclui o atual). key = 'AAAA-MM'. */
export function byMonth(entries, today, count = 12) {
  const current = monthKey(today);
  const keys = Array.from({ length: count }, (_, i) => addMonths(current, -(count - 1 - i)));
  return bucketize(entries, monthKey, keys);
}

/** Minutos por dia (Map 'AAAA-MM-DD' -> minutos). */
export function minutesByDay(entries) {
  const map = new Map();
  for (const e of entries) map.set(e.date, (map.get(e.date) || 0) + (Number(e.minutes) || 0));
  return map;
}

/**
 * Sequência de dias seguidos com leitura.
 * current: termina hoje, ou ontem se hoje ainda não houve leitura (a sequência segue viva).
 * longest: maior sequência já registrada.
 */
export function streak(entries, today) {
  const days = [...new Set(entries.map((e) => e.date))]
    .map(dayNumber)
    .sort((a, b) => a - b);
  if (!days.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const set = new Set(days);
  const t = dayNumber(today);
  let cursor = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  let current = 0;
  while (cursor !== null && set.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}

/**
 * Concluídos por período: conta itens com status 'lido' e finishedOn no período.
 * Retorna { semana, mes, ano, total } com { livros, artigos } (artigos inclui blogs).
 */
export function completedSummary(items, today) {
  const wStart = weekStart(today);
  const wEnd = addDays(wStart, 6);
  const month = monthKey(today);
  const year = yearKey(today);
  const empty = () => ({ livros: 0, artigos: 0 });
  const out = { semana: empty(), mes: empty(), ano: empty(), total: empty() };
  for (const item of items) {
    if (item.status !== 'lido' || !item.finishedOn) continue;
    const key = item.type === 'livro' ? 'livros' : 'artigos';
    const d = item.finishedOn;
    out.total[key] += 1;
    if (yearKey(d) === year) out.ano[key] += 1;
    if (monthKey(d) === month) out.mes[key] += 1;
    if (d >= wStart && d <= wEnd) out.semana[key] += 1;
  }
  return out;
}

/** Concluídos por mês (últimos `count` meses): [{ key, livros, artigos }] */
export function completedByMonth(items, today, count = 12) {
  const current = monthKey(today);
  const keys = Array.from({ length: count }, (_, i) => addMonths(current, -(count - 1 - i)));
  const map = new Map(keys.map((k) => [k, { key: k, livros: 0, artigos: 0 }]));
  for (const item of items) {
    if (item.status !== 'lido' || !item.finishedOn) continue;
    const bucket = map.get(monthKey(item.finishedOn));
    if (bucket) bucket[item.type === 'livro' ? 'livros' : 'artigos'] += 1;
  }
  return keys.map((k) => map.get(k));
}

/** Minutos totais de um item (soma das suas entradas). */
export function minutesOfItem(entries, itemId) {
  return totalMinutes(entries.filter((e) => e.itemId === itemId));
}
