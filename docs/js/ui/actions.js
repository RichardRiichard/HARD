// Ações do usuário: combinam regras puras (core/) com o store e dão retorno visual.
import * as store from '../data/store.js';
import { state } from '../data/store.js';
import {
  applyEntryEdit,
  applyProgress,
  correctCurrentPage,
  createEntry,
  itemAfterEntryDeleted,
  markArticleRead,
  setStatus,
} from '../core/progress.js';
import { displayMinutes } from '../core/calc.js';
import { today } from '../core/dates.js';
import { gainToast, toast } from './overlay.js';

/** Animação "+X min lidos" e pulso no total da tela inicial. */
export function celebrate(minutes) {
  const shown = displayMinutes(minutes);
  if (shown > 0) gainToast(shown);
  requestAnimationFrame(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    hero.classList.remove('bump');
    void hero.offsetWidth;
    hero.classList.add('bump');
  });
}

/** Salva um item novo; se readOn vier preenchido, já registra a leitura (artigos). */
export async function addArticle(item, { readOn } = {}) {
  if (readOn) {
    const { item: done, entry } = markArticleRead(item, { date: readOn });
    await store.commit({ items: [done], entries: [entry] });
    celebrate(entry.minutes);
    return done;
  }
  await store.commit({ items: [item] });
  toast('Salvo em "Quero ler"');
  return item;
}

export async function markRead(item, date = today()) {
  const { item: done, entry } = markArticleRead(item, { date });
  await store.commit({ items: [done], entries: [entry] });
  celebrate(entry.minutes);
}

/**
 * Livro novo. status: 'quero' | 'lendo' | 'lido'.
 * startPage: página em que já está (para "lido" é a última).
 * countPages: conta as páginas já lidas como uma entrada de leitura na data informada.
 */
export async function addBook(book, { status = 'quero', startPage = 0, countPages = false, date = today() } = {}) {
  if (status === 'quero') {
    await store.commit({ items: [book] });
    toast('Livro salvo em "Quero ler"');
    return book;
  }
  const page = status === 'lido' ? book.totalPages : Math.min(Math.max(0, startPage), book.totalPages);
  if (countPages && page > 0) {
    const r = applyProgress(book, page, { date, settings: state.settings });
    if (!r.ok) throw new Error('Página inválida');
    await store.commit({ items: [r.item], entries: [r.entry] });
    celebrate(r.entry.minutes);
    return r.item;
  }
  const item = setStatus(correctCurrentPage(book, page), page === book.totalPages ? 'lido' : status, { date });
  await store.commit({ items: [item] });
  toast('Livro adicionado');
  return item;
}

/** "Li até a página N". Retorna o resultado de applyProgress (ok/reason). */
export async function saveProgress(book, page, date = today()) {
  const r = applyProgress(book, page, { date, settings: state.settings });
  if (!r.ok) return r;
  await store.commit({ items: [r.item], entries: [r.entry] });
  celebrate(r.entry.minutes);
  if (r.item.status === 'lido') setTimeout(() => toast(`Livro concluído: ${book.title}`), 900);
  return r;
}

export async function fixCurrentPage(book, page) {
  await store.commit({ items: [correctCurrentPage(book, page)] });
  toast('Página atual corrigida');
}

export async function saveItem(item) {
  await store.commit({ items: [{ ...item, updatedAt: new Date().toISOString() }] });
}

export async function changeStatus(item, status, date = today()) {
  await store.commit({ items: [setStatus(item, status, { date })] });
}

export async function deleteItem(item) {
  const entries = store.entriesOf(item.id).map((e) => e.id);
  await store.commit({ deleteItems: [item.id], deleteEntries: entries });
  toast('Item apagado');
}

export async function deleteEntry(entry) {
  const item = store.getItem(entry.itemId);
  const remaining = store.entriesOf(entry.itemId).filter((e) => e.id !== entry.id);
  const updated = itemAfterEntryDeleted(item, entry, remaining);
  await store.commit({ deleteEntries: [entry.id], items: updated ? [updated] : [] });
  toast('Registro apagado');
}

/** Edita data/páginas/minutos de uma entrada. Retorna { ok, reason }. */
export async function updateEntry(entry, patch) {
  const item = store.getItem(entry.itemId);
  const r = applyEntryEdit(entry, patch, item);
  if (!r.ok) return r;
  await store.commit({ entries: [r.entry], items: r.item ? [r.item] : [] });
  toast('Registro atualizado');
  return r;
}

/** Registro avulso (ex.: reler um artigo). */
export async function addManualEntry(item, { date, minutes }) {
  const entry = createEntry({ itemId: item.id, date, minutes });
  await store.commit({ entries: [entry] });
  celebrate(entry.minutes);
}
