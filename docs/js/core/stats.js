// Agregações para a tela inicial e estatísticas. Funções puras (tests/stats.test.js).
// Entradas têm date 'AAAA-MM-DD' (já no fuso de São Paulo), então somas por
// semana/mês não dependem do fuso do aparelho.

import { addDays, addMonths, monthKey, weekStart, yearKey } from './dates.js';
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

/**
 * Ritmo: média de minutos por dia nos últimos `days` dias (terminando hoje)
 * e comparação com os `days` dias anteriores. changePct é null sem base de comparação.
 */
export function pace(entries, today, days = 30) {
  const start = addDays(today, -(days - 1));
  const prevStart = addDays(start, -days);
  const prevEnd = addDays(start, -1);
  const current = totalMinutes(entries.filter((e) => e.date >= start && e.date <= today));
  const previous = totalMinutes(entries.filter((e) => e.date >= prevStart && e.date <= prevEnd));
  return {
    days,
    total: current,
    perDay: round1(current / days),
    previousTotal: previous,
    previousPerDay: round1(previous / days),
    changePct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

/** Soma minutos por chave; `items` = quantas leituras diferentes entraram em cada linha. */
function ranking(entries, keyOf, n) {
  const map = new Map();
  for (const e of entries) {
    const key = keyOf(e);
    if (!key) continue;
    const row = map.get(key.id) || { ...key, minutes: 0, itemIds: new Set() };
    row.minutes += Number(e.minutes) || 0;
    row.itemIds.add(e.itemId);
    map.set(key.id, row);
  }
  return [...map.values()]
    .map(({ itemIds, ...r }) => ({ ...r, minutes: round1(r.minutes), items: itemIds.size }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, n);
}

/** Entradas dentro de um período: '30d' (últimos 30 dias), 'ano' (ano atual) ou 'sempre'. */
export function entriesInPeriod(entries, period, today) {
  if (period === '30d') {
    const start = addDays(today, -29);
    return entries.filter((e) => e.date >= start && e.date <= today);
  }
  if (period === 'ano') return entries.filter((e) => yearKey(e.date) === yearKey(today));
  return entries;
}

/** Itens com mais tempo lido: [{ id, label, type, minutes }] */
export function topItems(entries, itemsById, n = 5) {
  return ranking(
    entries,
    (e) => {
      const item = itemsById.get(e.itemId);
      return item ? { id: item.id, label: item.title, type: item.type } : null;
    },
    n,
  );
}

/**
 * Autores dos livros (kind 'autor') ou sites/publicações dos artigos e posts (kind 'site')
 * com mais tempo lido: [{ id, label, minutes, items }]. Nomes iguais com maiúsculas diferentes se juntam.
 */
export function topSources(entries, itemsById, kind, n = 5) {
  return ranking(
    entries,
    (e) => {
      const item = itemsById.get(e.itemId);
      if (!item || (kind === 'autor') !== (item.type === 'livro')) return null;
      const label = String((item.type === 'livro' ? item.author : item.site) || '').trim();
      if (!label) return null;
      return { id: label.toLocaleLowerCase('pt-BR'), label };
    },
    n,
  );
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
