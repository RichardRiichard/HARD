// Datas do app são strings 'AAAA-MM-DD' no fuso de São Paulo.
// Toda a aritmética é feita em "número do dia" (dias desde 1970-01-01),
// o que evita surpresas com fuso e horário de verão.

export const TZ = 'America/Sao_Paulo';

const formatters = new Map();
function formatterFor(tz) {
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }),
    );
  }
  return formatters.get(tz);
}

/** Data local (AAAA-MM-DD) de um instante, no fuso informado. */
export function toLocalDate(instant = new Date(), tz = TZ) {
  const d = instant instanceof Date ? instant : new Date(instant);
  const parts = formatterFor(tz).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function today(now = new Date()) {
  return toLocalDate(now, TZ);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(s) {
  const m = DATE_RE.exec(s ?? '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function dayNumber(s) {
  const m = DATE_RE.exec(s);
  if (!m) throw new Error(`Data inválida: ${s}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

export function fromDayNumber(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

export function addDays(s, n) {
  return fromDayNumber(dayNumber(s) + n);
}

/** 0 = segunda ... 6 = domingo */
export function weekdayIndex(s) {
  return (new Date(dayNumber(s) * 86400000).getUTCDay() + 6) % 7;
}

/** Segunda-feira da semana da data. */
export function weekStart(s) {
  return addDays(s, -weekdayIndex(s));
}

export function monthKey(s) {
  return s.slice(0, 7);
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

export function yearKey(s) {
  return s.slice(0, 4);
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/** "qua, 15 de out" (ano só se for diferente do ano de referência) */
export function formatDay(s, ref = today()) {
  const [y, m, d] = s.split('-').map(Number);
  const base = `${WEEKDAYS[weekdayIndex(s)]}, ${d} de ${MONTHS[m - 1]}`;
  return yearKey(s) === yearKey(ref) ? base : `${base} de ${y}`;
}

/** "Hoje", "Ontem" ou formatDay */
export function formatDayRelative(s, ref = today()) {
  if (s === ref) return 'Hoje';
  if (s === addDays(ref, -1)) return 'Ontem';
  return formatDay(s, ref);
}

/** "15/10/2026" */
export function formatDateShort(s) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** "out/26" */
export function formatMonthShort(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

/** "outubro de 2026" */
export function formatMonthLong(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} de ${y}`;
}

/** "13/10" — rótulo curto de semana (data da segunda-feira) */
export function formatWeekShort(s) {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

/** Data e hora local de um instante ISO: "15/10/2026 às 14:05" */
export function formatDateTime(iso, tz = TZ) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = formatDateShort(toLocalDate(d, tz));
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${date} às ${time}`;
}
