// Busca de livros em várias fontes gratuitas, consultadas juntas:
// - Google Books (com chave de API em config.js, para não depender da cota compartilhada)
// - Open Library
// - BrasilAPI ISBN (base da CBL: livros brasileiros) — só por ISBN
import { GOOGLE_BOOKS_API_KEY } from '../config.js';

const TIMEOUT_MS = 12000;

/** Retorna o ISBN limpo se o texto parece um ISBN-10/13, senão null. */
export function asIsbn(text) {
  const clean = String(text || '').replace(/[\s-]/g, '').toUpperCase();
  return /^(\d{9}[\dX]|\d{13})$/.test(clean) ? clean : null;
}

async function getJson(url) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Sem conexão com a internet.');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 404) return null;
    if (res.status === 429) throw new Error('limite de buscas atingido');
    if (!res.ok) throw new Error(`erro ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('demorou demais');
    if (err instanceof TypeError) throw new Error('sem conexão');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function pickIsbn(list) {
  if (!Array.isArray(list)) return '';
  return list.find((x) => /^\d{13}$/.test(x)) || list[0] || '';
}

const https = (url) => String(url || '').replace(/^http:/, 'https:');

/** Converte um documento da Open Library para o formato do app. */
export function fromOpenLibrary(doc) {
  return {
    title: doc.title || '',
    author: (doc.author_name || []).slice(0, 3).join(', '),
    totalPages: doc.number_of_pages_median || null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
    isbn: pickIsbn(doc.isbn),
    year: doc.first_publish_year || null,
    publisher: '',
    source: 'openlibrary',
  };
}

/** Converte um volume do Google Books para o formato do app. */
export function fromGoogleBooks(volume) {
  const v = volume.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = (ids.find((i) => i.type === 'ISBN_13') || ids.find((i) => i.type === 'ISBN_10') || {}).identifier || '';
  return {
    title: [v.title, v.subtitle].filter(Boolean).join(': '),
    author: (v.authors || []).slice(0, 3).join(', '),
    totalPages: v.pageCount || null,
    coverUrl: https(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail),
    isbn,
    year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) || null : null,
    publisher: v.publisher || '',
    source: 'google',
  };
}

/** Converte a resposta da BrasilAPI (ISBN) para o formato do app. */
export function fromBrasilApi(b) {
  return {
    title: [b.title, b.subtitle].filter(Boolean).join(': '),
    author: (b.authors || []).slice(0, 3).join(', '),
    totalPages: b.page_count || null,
    coverUrl: https(b.cover_url),
    isbn: b.isbn || '',
    year: b.year || null,
    publisher: b.publisher || '',
    source: 'brasilapi',
  };
}

export async function searchOpenLibrary(query) {
  const isbn = asIsbn(query);
  const params = new URLSearchParams({
    fields: 'key,title,author_name,cover_i,number_of_pages_median,isbn,first_publish_year',
    limit: '15',
  });
  if (isbn) params.set('isbn', isbn);
  else params.set('q', query);
  const data = await getJson(`https://openlibrary.org/search.json?${params}`);
  return (data?.docs || []).map(fromOpenLibrary).filter((b) => b.title);
}

export async function searchGoogleBooks(query) {
  const isbn = asIsbn(query);
  const params = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : query, maxResults: '20', printType: 'books' });
  if (GOOGLE_BOOKS_API_KEY.trim()) params.set('key', GOOGLE_BOOKS_API_KEY.trim());
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
  return (data?.items || []).map(fromGoogleBooks).filter((b) => b.title);
}

export async function searchBrasilApi(query) {
  const isbn = asIsbn(query);
  if (!isbn) return [];
  const data = await getJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
  return data?.title ? [fromBrasilApi(data)] : [];
}

const norm = (s) =>
  String(s || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Chave para reconhecer o mesmo livro vindo de fontes diferentes. */
function bookKey(b) {
  const title = norm(b.title.split(':')[0]);
  const author = norm(b.author.split(',')[0]).split(' ').pop() || '';
  return `${title}|${author}`;
}

/**
 * Junta resultados de várias fontes (na ordem de prioridade), removendo repetidos
 * e completando campos vazios (páginas, capa, ISBN) com os das outras fontes.
 */
export function mergeResults(lists) {
  const merged = [];
  const byIsbn = new Map();
  const byKey = new Map();
  for (const list of lists) {
    for (const b of list) {
      const existing = (b.isbn && byIsbn.get(b.isbn)) || byKey.get(bookKey(b));
      if (existing) {
        for (const field of ['totalPages', 'coverUrl', 'isbn', 'year', 'publisher', 'author']) {
          if (!existing[field] && b[field]) existing[field] = b[field];
        }
      } else {
        const copy = { ...b };
        merged.push(copy);
        byKey.set(bookKey(copy), copy);
        if (copy.isbn) byIsbn.set(copy.isbn, copy);
      }
      const target = existing || merged[merged.length - 1];
      if (target.isbn) byIsbn.set(target.isbn, target);
    }
  }
  // Sem capa nas fontes: tenta a capa da Open Library pelo ISBN (se não existir, aparecem as iniciais).
  for (const b of merged) if (!b.coverUrl && b.isbn) b.coverUrl = coverByIsbn(b.isbn);
  return merged;
}

export function coverByIsbn(isbn) {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`;
}

export const SOURCES = {
  brasilapi: { label: 'BrasilAPI', search: searchBrasilApi },
  google: { label: 'Google Books', search: searchGoogleBooks },
  openlibrary: { label: 'Open Library', search: searchOpenLibrary },
};

/**
 * Busca em todas as fontes ao mesmo tempo.
 * Retorna { results, failures: [{ label, message }] } — uma fonte com erro não impede as outras.
 */
export async function searchAll(query) {
  const entries = Object.values(SOURCES);
  const settled = await Promise.allSettled(entries.map((s) => s.search(query)));
  const lists = [];
  const failures = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') lists.push(r.value);
    else failures.push({ label: entries[i].label, message: r.reason?.message || 'erro' });
  });
  return { results: mergeResults(lists), failures };
}
