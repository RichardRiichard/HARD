// "+ Adicionar leitura": escolha do tipo.
import { html } from '../dom.js';
import { icon } from '../icons.js';
import { openSheet } from '../overlay.js';
import { openArticleForm } from './article-form.js';
import { openBookSearch } from './book-search.js';
import { openPdfImport } from './pdf-import.js';

export function openAddChooser() {
  const sheet = openSheet({
    title: 'Adicionar leitura',
    className: 'sheet-small',
    content: html`<div class="choice-list">
      <button type="button" class="choice" data-kind="livro">
        <span class="type-dot livro">${icon('livro')}</span>
        <div><b>Livro</b><span>Buscar por título, autor ou ISBN</span></div>
      </button>
      <button type="button" class="choice" data-kind="artigo">
        <span class="type-dot artigo">${icon('artigo')}</span>
        <div><b>Artigo</b><span>Tempo em minutos, páginas, tamanho ou texto colado</span></div>
      </button>
      <button type="button" class="choice" data-kind="blog">
        <span class="type-dot blog">${icon('blog')}</span>
        <div><b>Post de blog</b><span>Cole o link do Substack e os dados vêm sozinhos</span></div>
      </button>
      <button type="button" class="choice" data-kind="pdf">
        <span class="type-dot livro">${icon('page')}</span>
        <div><b>PDF</b><span>Lê título e páginas do arquivo (livro ou artigo)</span></div>
      </button>
    </div>`,
  });
  sheet.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-kind]');
    if (!btn) return;
    sheet.close();
    if (btn.dataset.kind === 'livro') openBookSearch();
    else if (btn.dataset.kind === 'pdf') openPdfImport();
    else openArticleForm({ type: btn.dataset.kind });
  });
}
