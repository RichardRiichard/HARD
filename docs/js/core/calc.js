// Cálculos de tempo estimado de leitura. Funções puras (testadas em tests/calc.test.js).

export const DEFAULT_SETTINGS = Object.freeze({
  minPerPage: 1.5,
  wpm: 220,
  sizes: Object.freeze({ curto: 5, medio: 10, longo: 20, muitoLongo: 35 }),
});

export const SIZE_LABELS = Object.freeze({
  curto: 'Curto',
  medio: 'Médio',
  longo: 'Longo',
  muitoLongo: 'Muito longo',
});

/** Arredonda para 1 casa decimal, sem ruído de ponto flutuante. */
export function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Aceita "1,5", "1.5", " 2 " e números. Retorna NaN se inválido. */
export function parseDecimal(value) {
  if (typeof value === 'number') return value;
  const s = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Minutos por página efetivos: o do livro, se definido, senão o padrão. */
export function effectiveMinPerPage(book, settings = DEFAULT_SETTINGS) {
  const own = Number(book?.minPerPage);
  return Number.isFinite(own) && own > 0 ? own : settings.minPerPage;
}

/** Tempo de leitura de livro: páginas × minutos por página. */
export function bookMinutes(pages, minPerPage) {
  if (!(pages > 0) || !(minPerPage > 0)) return 0;
  return round1(pages * minPerPage);
}

/** Conta palavras: sequências separadas por espaço que contenham letra ou número. */
export function countWords(text) {
  if (!text) return 0;
  return String(text)
    .split(/\s+/u)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Palavras ÷ palavras por minuto, arredondado; no mínimo 1 min se houver texto. */
export function wordsToMinutes(words, wpm = DEFAULT_SETTINGS.wpm) {
  if (!(words > 0) || !(wpm > 0)) return 0;
  return Math.max(1, Math.round(words / wpm));
}

/** Minutos de um tamanho rápido (curto, medio, longo, muitoLongo). */
export function sizeMinutes(size, sizes = DEFAULT_SETTINGS.sizes) {
  const v = Number(sizes?.[size]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Inteiro para exibir em "+X min lidos" (nunca "+0" quando houve leitura). */
export function displayMinutes(minutes) {
  if (!(minutes > 0)) return 0;
  return Math.max(1, Math.round(minutes));
}

/** "45 min", "1 h", "2 h 5 min" */
export function formatDuration(minutes) {
  const total = Math.round(Math.max(0, minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Separa horas e minutos (para o destaque do total). */
export function splitHours(minutes) {
  const total = Math.round(Math.max(0, minutes || 0));
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Número com vírgula decimal, sem zeros sobrando: 1.5 -> "1,5", 2 -> "2" */
export function formatDecimal(n, digits = 2) {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(digits))).replace('.', ',');
}

/** Formata número inteiro com separador de milhar: 12345 -> "12.345" */
export function formatInt(n) {
  return Math.round(n || 0).toLocaleString('pt-BR');
}

/** Normaliza configurações vindas do banco/backup, mantendo padrões válidos. */
export function normalizeSettings(raw = {}) {
  const pos = (v, fallback) => {
    const n = parseDecimal(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const sizes = {};
  for (const key of Object.keys(DEFAULT_SETTINGS.sizes)) {
    sizes[key] = pos(raw.sizes?.[key], DEFAULT_SETTINGS.sizes[key]);
  }
  return {
    minPerPage: pos(raw.minPerPage, DEFAULT_SETTINGS.minPerPage),
    wpm: pos(raw.wpm, DEFAULT_SETTINGS.wpm),
    sizes,
  };
}
