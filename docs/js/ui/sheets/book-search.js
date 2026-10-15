// Busca de livro por título, autor ou ISBN (Open Library / Google Books).
import { html, $, setHtml } from '../dom.js';
import { icon } from '../icons.js';
import { openSheet } from '../overlay.js';
import { cover } from '../components.js';
import { SOURCES, asIsbn } from '../../services/books-api.js';
import { openBookForm } from './book-form.js';

export function openBookSearch() {
  let source = 'openlibrary';
  let results = [];
  let lastQuery = '';
  let seq = 0;

  const sheet = openSheet({
    title: 'Adicionar livro',
    content: html`<form class="search-bar" role="search">
        <input type="search" name="q" placeholder="Título, autor ou ISBN" autocomplete="off" enterkeyhint="search" autofocus aria-label="Buscar livro">
        <button type="submit" class="btn btn-primary" aria-label="Buscar">${icon('search')}</button>
      </form>
      <div class="seg" role="group" aria-label="Fonte da busca">
        ${Object.entries(SOURCES).map(
          ([key, s]) => html`<button type="button" data-source="${key}" aria-pressed="${String(key === source)}">${s.label}</button>`,
        )}
      </div>
      <div id="bs-status" class="status-line" aria-live="polite"></div>
      <div id="bs-results" class="results"></div>
      <div class="section" style="margin-top:16px">
        <button type="button" class="btn btn-block" data-manual>${icon('edit')} Não encontrei: cadastrar manualmente</button>
      </div>`,
  });

  const form = $('form', sheet.body);
  const status = $('#bs-status', sheet.body);
  const list = $('#bs-results', sheet.body);

  function setSource(key) {
    source = key;
    for (const b of sheet.body.querySelectorAll('[data-source]')) b.setAttribute('aria-pressed', String(b.dataset.source === key));
  }

  function other() {
    return source === 'openlibrary' ? 'google' : 'openlibrary';
  }

  function renderResults() {
    setHtml(
      list,
      results.map(
        (b, i) => html`<button type="button" class="row" data-pick="${i}">
          ${cover({ type: 'livro', title: b.title, coverUrl: b.coverUrl })}
          <div class="row-main">
            <div class="row-title">${b.title}</div>
            <div class="row-sub">${[b.author, b.year].filter(Boolean).join(' · ') || 'Autor desconhecido'}</div>
            <div class="row-sub">${b.totalPages ? `${b.totalPages} páginas` : 'Páginas não informadas'}</div>
          </div>
        </button>`,
      ),
    );
  }

  async function search(q) {
    lastQuery = q;
    const id = ++seq;
    results = [];
    renderResults();
    status.textContent = `Buscando na ${SOURCES[source].label}…`;
    try {
      const found = await SOURCES[source].search(q);
      if (id !== seq) return;
      results = found;
      renderResults();
      if (found.length) {
        setHtml(status, html`${found.length} resultado${found.length > 1 ? 's' : ''}. <button type="button" class="link-btn" data-try="${other()}">Buscar no ${SOURCES[other()].label}</button>`);
      } else {
        setHtml(status, html`Nada encontrado na ${SOURCES[source].label}. <button type="button" class="link-btn" data-try="${other()}">Tentar no ${SOURCES[other()].label}</button>`);
      }
    } catch (err) {
      if (id !== seq) return;
      setHtml(status, html`${err.message} <button type="button" class="link-btn" data-try="${other()}">Tentar no ${SOURCES[other()].label}</button>`);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.elements.q.value.trim();
    if (q) search(q);
    form.elements.q.blur();
  });

  sheet.body.addEventListener('click', (e) => {
    const src = e.target.closest('[data-source]');
    if (src) {
      setSource(src.dataset.source);
      if (lastQuery) search(lastQuery);
      return;
    }
    const tryBtn = e.target.closest('[data-try]');
    if (tryBtn) {
      setSource(tryBtn.dataset.try);
      if (lastQuery) search(lastQuery);
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
}
