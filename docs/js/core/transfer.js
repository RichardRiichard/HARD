// Formato de backup (JSON) e exportação CSV. Funções puras (tests/transfer.test.js).

import { isValidDate, formatDateShort } from './dates.js';
import { formatDecimal } from './calc.js';
import { TYPES } from './progress.js';

export const APP_ID = 'leituras';
export const SCHEMA = 1;

export function buildExport({ items, entries, settings, dataUpdatedAt }, now = new Date()) {
  return {
    app: APP_ID,
    schema: SCHEMA,
    exportedAt: now.toISOString(),
    dataUpdatedAt: dataUpdatedAt || now.toISOString(),
    settings,
    items,
    entries,
  };
}

const TYPE_KEYS = new Set(['livro', 'artigo', 'blog']);
const STATUS_KEYS = new Set(['quero', 'lendo', 'lido', 'abandonado']);

/**
 * Valida um backup (objeto ou texto JSON).
 * Retorna { ok: true, data } ou { ok: false, error } com mensagem em português.
 */
export function parseBackup(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, error: 'O arquivo não é um JSON válido.' };
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'Arquivo vazio ou inválido.' };
  if (data.app !== APP_ID) return { ok: false, error: 'Este arquivo não é um backup do app Leituras.' };
  if (typeof data.schema !== 'number' || data.schema > SCHEMA) {
    return { ok: false, error: 'Backup de uma versão mais nova do app. Atualize o app e tente de novo.' };
  }
  if (!Array.isArray(data.items) || !Array.isArray(data.entries)) {
    return { ok: false, error: 'Backup incompleto: faltam itens ou registros.' };
  }
  const ids = new Set();
  for (const item of data.items) {
    if (!item || typeof item.id !== 'string' || !TYPE_KEYS.has(item.type) || !STATUS_KEYS.has(item.status)) {
      return { ok: false, error: 'Backup com item inválido.' };
    }
    ids.add(item.id);
  }
  for (const e of data.entries) {
    if (!e || typeof e.id !== 'string' || typeof e.itemId !== 'string' || !isValidDate(e.date) || !Number.isFinite(e.minutes)) {
      return { ok: false, error: 'Backup com registro de leitura inválido.' };
    }
  }
  return {
    ok: true,
    data: {
      items: data.items,
      // Registros cujo item não existe mais são descartados.
      entries: data.entries.filter((e) => ids.has(e.itemId)),
      settings: data.settings || {},
      dataUpdatedAt: typeof data.dataUpdatedAt === 'string' ? data.dataUpdatedAt : null,
      exportedAt: data.exportedAt || null,
    },
  };
}

function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Histórico em CSV para planilhas em português (separador ";" e vírgula decimal).
 * Linhas do registro mais antigo para o mais recente.
 */
export function entriesToCsv(entries, itemsById) {
  const header = ['Data', 'Tipo', 'Título', 'Autor/Site', 'Página inicial', 'Página final', 'Páginas', 'Minutos'];
  const rows = [...entries]
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((e) => {
      const item = itemsById.get(e.itemId);
      return [
        formatDateShort(e.date),
        item ? TYPES[item.type] : '',
        item ? item.title : '(item apagado)',
        item ? (item.type === 'livro' ? item.author : item.site) : '',
        e.pageFrom ?? '',
        e.pageTo ?? '',
        e.pages ?? '',
        formatDecimal(e.minutes),
      ];
    });
  return [header, ...rows].map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n';
}
