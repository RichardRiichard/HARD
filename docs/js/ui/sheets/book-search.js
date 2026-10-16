// Busca de livro por título, autor ou ISBN em todas as fontes ao mesmo tempo
// (Google Books, Open Library e BrasilAPI), ou a partir de um PDF.
import { html, $, setHtml } from '../dom.js';
import { icon } from '../icons.js';
import { openSheet } from '../overlay.js';
import { cover } from '../components.js';
import { searchAll, asIsbn } from '../../services/books-api.js';
import { openBookForm } from './book-form.js';
import { openPdfImport } from './pdf-import.js';

const SOURCE_LABEL = { google: 'Google Books', openlibrary: 'Open Library', brasilapi: 'BrasilAPI' };

export function openBookSearch(initialQuery = '') {
  let results = [];
  let seq = 0;

  const sheet = openSheet({
    title: 'Adicionar livro',
    content: html`<form class="search-bar" role="search">
        <input type="search" name="q" placeholder="Título, autor ou ISBN" autocomplete="off" enterkeyhint="search" ${initialQuery ? '' : 'autofocus'} value="${initialQuery}" aria-label="Buscar livro">
        <button type="submit" class="btn btn-primary" aria-label="Buscar">${icon('search')}</button>
      </form>
      <button type="button" class="btn btn-sm btn-block" data-pdf>${icon('page')} Livro em PDF</button>
      <div id="bs-status" class="status-line" aria-live="polite">Busca no Google Books, na Open Library e, por ISBN, na base brasileira (BrasilAPI).</div>
      <div id="bs-results" class="results"></div>
      <div class="section" style="margin-top:16px">
        <button type="button" class="btn btn-block" data-manual>${icon('edit')} Não encontrei: cadastrar manualmente</button>
      </div>`,
  });

  const form = $('form', sheet.body);
  const status = $('#bs-status', sheet.body);
  const list = $('#bs-results', sheet.body);

  function renderResults() {
    setHtml(
      list,
      results.map(
        (b, i) => html`<button type="button" class="row" data-pick="${i}">
          ${cover({ type: 'livro', title: b.title, coverUrl: b.coverUrl })}
          <div class="row-main">
            <div class="row-title">${b.title}</div>
            <div class="row-sub">${[b.author, b.year].filter(Boolean).join(' · ') || 'Autor desconhecido'}</div>
            <div class="row-sub">${b.totalPages ? `${b.totalPages} páginas` : 'Páginas não informadas'} · ${SOURCE_LABEL[b.source] || ''}</div>
          </div>
        </button>`,
      ),
    );
  }

  async function search(q) {
    const id = ++seq;
    results = [];
    renderResults();
    status.textContent = 'Buscando…';
    const { results: found, failures } = await searchAll(q);
    if (id !== seq) return;
    results = found;
    renderResults();
    const failed = failures.length ? ` (${failures.map((f) => `${f.label}: ${f.message}`).join('; ')})` : '';
    if (found.length) status.textContent = `${found.length} resultado${found.length > 1 ? 's' : ''}${failed}.`;
    else if (failures.length === 3) status.textContent = `Não foi possível buscar agora${failed}.`;
    else status.textContent = `Nada encontrado${failed}. ${asIsbn(q) ? 'Confira o ISBN ou' : 'Tente o ISBN (atrás do livro) ou'} cadastre manualmente.`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.elements.q.value.trim();
    if (q) search(q);
    form.elements.q.blur();
  });

  sheet.body.addEventListener('click', async (e) => {
    if (e.target.closest('[data-pdf]')) {
      sheet.close();
      openPdfImport({ as: 'livro' });
      return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const data = results[Number(pick.dataset.pick)];
      sheet.close();
      openBookForm({ data });
      return;
    }
    if (e.target.closest('[data-manual]')) {
      const typed = form.elements.q.value.trim();
      sheet.close();
      const isbn = asIsbn(typed);
      openBookForm({ data: isbn ? { isbn, source: 'manual' } : { title: typed, source: 'manual' } });
    }
  });

  if (initialQuery) search(initialQuery);
}
