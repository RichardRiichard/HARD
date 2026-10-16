// Regras de negócio puras: criação de itens, progresso por página e entradas de leitura.
// Nada aqui toca no banco; o store aplica os resultados. Testado em tests/progress.test.js.

import { bookMinutes, effectiveMinPerPage, round1 } from './calc.js';

export const TYPES = Object.freeze({ livro: 'Livro', artigo: 'Artigo', blog: 'Blog' });

export const STATUS = Object.freeze({
  quero: 'Quero ler',
  lendo: 'Lendo',
  lido: 'Lido',
  abandonado: 'Abandonado',
});

/** Status possíveis por tipo (artigos não ficam "lendo"). */
export function statusesFor(type) {
  return type === 'livro' ? ['quero', 'lendo', 'lido', 'abandonado'] : ['quero', 'lido', 'abandonado'];
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const iso = (now) => (now instanceof Date ? now : new Date(now)).toISOString();

export function createBook(data, now = new Date()) {
  const ts = iso(now);
  return {
    id: newId(),
    type: 'livro',
    title: String(data.title ?? '').trim(),
    author: String(data.author ?? '').trim(),
    totalPages: Math.max(1, Math.round(Number(data.totalPages) || 0)),
    currentPage: 0,
    minPerPage: data.minPerPage > 0 ? Number(data.minPerPage) : null,
    coverUrl: data.coverUrl || '',
    isbn: data.isbn || '',
    source: data.source || 'manual',
    status: 'quero',
    startedOn: null,
    finishedOn: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function createArticle(data, now = new Date()) {
  const ts = iso(now);
  return {
    id: newId(),
    type: data.type === 'blog' ? 'blog' : 'artigo',
    title: String(data.title ?? '').trim(),
    site: String(data.site ?? '').trim(),
    url: String(data.url ?? '').trim(),
    minutes: round1(Math.max(0, Number(data.minutes) || 0)),
    timeMode: data.timeMode || 'manual',
    wordCount: data.wordCount || null,
    status: 'quero',
    finishedOn: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function createEntry({ itemId, date, minutes, pages = null, pageFrom = null, pageTo = null }, now = new Date()) {
  return {
    id: newId(),
    itemId,
    date,
    createdAt: iso(now),
    pageFrom,
    pageTo,
    pages,
    minutes: round1(Math.max(0, Number(minutes) || 0)),
  };
}

/**
 * "Li até a página N": calcula as páginas desde o último registro e gera a entrada.
 * Retorna { ok: true, item, entry } ou { ok: false, reason }.
 * reason: 'invalid' | 'beyond' (passa do total) | 'same' (nada novo) | 'backwards' (menor que a atual)
 */
export function applyProgress(book, targetPage, { date, settings, now = new Date() }) {
  const target = Number(targetPage);
  if (!Number.isInteger(target) || target < 0) return { ok: false, reason: 'invalid' };
  if (target > book.totalPages) return { ok: false, reason: 'beyond' };
  const current = book.currentPage || 0;
  if (target === current) return { ok: false, reason: 'same' };
  if (target < current) return { ok: false, reason: 'backwards' };

  const pages = target - current;
  const minutes = bookMinutes(pages, effectiveMinPerPage(book, settings));
  const finished = target === book.totalPages;
  const item = {
    ...book,
    currentPage: target,
    status: finished ? 'lido' : 'lendo',
    startedOn: book.startedOn || date,
    finishedOn: finished ? date : null,
    updatedAt: iso(now),
  };
  const entry = createEntry({ itemId: book.id, date, minutes, pages, pageFrom: current, pageTo: target }, now);
  return { ok: true, item, entry };
}

/** Corrige a página atual sem gerar leitura (ex.: digitou errado antes). */
export function correctCurrentPage(book, page, now = new Date()) {
  const p = Math.min(Math.max(0, Math.round(Number(page) || 0)), book.totalPages);
  const finished = p === book.totalPages;
  return {
    ...book,
    currentPage: p,
    status: finished ? 'lido' : book.status === 'lido' ? 'lendo' : book.status,
    finishedOn: finished ? book.finishedOn : null,
    updatedAt: iso(now),
  };
}

/** Marca artigo/blog como lido e gera a entrada com o tempo do item. */
export function markArticleRead(article, { date, now = new Date() }) {
  const item = { ...article, status: 'lido', finishedOn: date, updatedAt: iso(now) };
  const entry = createEntry({ itemId: article.id, date, minutes: article.minutes }, now);
  return { item, entry };
}

/** Troca de status manual (sem gerar entrada). */
export function setStatus(item, status, { date, now = new Date() }) {
  const next = { ...item, status, updatedAt: iso(now) };
  if (status === 'lido') next.finishedOn = item.finishedOn || date;
  else next.finishedOn = null;
  if (item.type === 'livro' && status === 'lendo' && !item.startedOn) next.startedOn = date;
  return next;
}

/**
 * Ajusta o item depois que uma entrada é apagada, para o "desfazer" ficar coerente.
 * - Livro: se a entrada era a última (pageTo = página atual), volta para pageFrom.
 * - Artigo: se não sobrou nenhuma entrada, volta para "quero ler".
 * Retorna o item atualizado ou null se nada muda.
 */
export function itemAfterEntryDeleted(item, entry, remainingEntriesOfItem, now = new Date()) {
  if (!item) return null;
  if (item.type === 'livro') {
    if (entry.pageTo == null || entry.pageFrom == null || entry.pageTo !== item.currentPage) return null;
    return {
      ...item,
      currentPage: entry.pageFrom,
      status: item.status === 'lido' ? 'lendo' : item.status,
      finishedOn: item.status === 'lido' ? null : item.finishedOn,
      updatedAt: iso(now),
    };
  }
  if (remainingEntriesOfItem.length === 0 && item.status === 'lido') {
    return { ...item, status: 'quero', finishedOn: null, updatedAt: iso(now) };
  }
  return null;
}

/**
 * Aplica a edição de uma entrada (data, páginas, minutos).
 * Para livros, mudar as páginas move pageTo; se era a última entrada, a página atual acompanha.
 * Retorna { ok: true, entry, item|null } ou { ok: false, reason: 'invalid' | 'beyond' }.
 */
export function applyEntryEdit(entry, patch, item, now = new Date()) {
  const minutes = Number(patch.minutes);
  if (!Number.isFinite(minutes) || minutes < 0) return { ok: false, reason: 'invalid' };
  const next = { ...entry, date: patch.date || entry.date, minutes: round1(minutes) };
  let nextItem = null;

  if (item?.type === 'livro' && patch.pages != null && entry.pageFrom != null) {
    const pages = Number(patch.pages);
    if (!Number.isInteger(pages) || pages < 0) return { ok: false, reason: 'invalid' };
    const pageTo = entry.pageFrom + pages;
    if (pageTo > item.totalPages) return { ok: false, reason: 'beyond' };
    next.pages = pages;
    next.pageTo = pageTo;
    if (entry.pageTo === item.currentPage && pageTo !== entry.pageTo) {
      const finished = pageTo === item.totalPages;
      nextItem = {
        ...item,
        currentPage: pageTo,
        status: finished ? 'lido' : item.status === 'lido' ? 'lendo' : item.status,
        finishedOn: finished ? next.date : null,
        updatedAt: iso(now),
      };
    }
  }
  return { ok: true, entry: next, item: nextItem };
}
