// Busca de livros: Open Library (principal) e Google Books (alternativa). Ambas sem chave.

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
    if (res.status === 429) throw new Error('Limite de buscas atingido no serviço. Tente de novo em alguns minutos.');
    if (!res.ok) throw new Error(`O serviço respondeu com erro ${res.status}.`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('A busca demorou demais. Verifique a conexão.');
    if (err instanceof TypeError) throw new Error('Não foi possível conectar ao serviço de busca.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function pickIsbn(list) {
  if (!Array.isArray(list)) return '';
  return list.find((x) => /^\d{13}$/.test(x)) || list[0] || '';
}

/** Converte um documento da Open Library para o formato do app. */
export function fromOpenLibrary(doc) {
  return {
    title: doc.title || '',
    author: (doc.author_name || []).slice(0, 3).join(', '),
    totalPages: doc.number_of_pages_median || null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
    isbn: pickIsbn(doc.isbn),
    year: doc.first_publish_year || null,
    source: 'openlibrary',
  };
}

/** Converte um volume do Google Books para o formato do app. */
export function fromGoogleBooks(volume) {
  const v = volume.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = (ids.find((i) => i.type === 'ISBN_13') || ids.find((i) => i.type === 'ISBN_10') || {}).identifier || '';
  const thumb = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '';
  return {
    title: [v.title, v.subtitle].filter(Boolean).join(': '),
    author: (v.authors || []).slice(0, 3).join(', '),
    totalPages: v.pageCount || null,
    coverUrl: thumb.replace(/^http:/, 'https:'),
    isbn,
    year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) || null : null,
    source: 'google',
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
  return (data.docs || []).map(fromOpenLibrary).filter((b) => b.title);
}

export async function searchGoogleBooks(query) {
  const isbn = asIsbn(query);
  const params = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : query,
    maxResults: '15',
    printType: 'books',
  });
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
  return (data.items || []).map(fromGoogleBooks).filter((b) => b.title);
}

export const SOURCES = {
  openlibrary: { label: 'Open Library', search: searchOpenLibrary },
  google: { label: 'Google Books', search: searchGoogleBooks },
};
