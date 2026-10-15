// "+ Adicionar leitura": escolha do tipo.
import { html } from '../dom.js';
import { icon } from '../icons.js';
import { openSheet } from '../overlay.js';
import { openArticleForm } from './article-form.js';
import { openBookSearch } from './book-search.js';

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
        <div><b>Artigo</b><span>Tempo informado, tamanho ou texto colado</span></div>
      </button>
      <button type="button" class="choice" data-kind="blog">
        <span class="type-dot blog">${icon('blog')}</span>
        <div><b>Post de blog</b><span>Mesmas opções do artigo</span></div>
      </button>
    </div>`,
  });
  sheet.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-kind]');
    if (!btn) return;
    sheet.close();
    if (btn.dataset.kind === 'livro') openBookSearch();
    else openArticleForm({ type: btn.dataset.kind });
  });
}
