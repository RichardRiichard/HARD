// Importar um PDF: lê título e páginas e pergunta se é livro (progresso por página)
// ou artigo (lido de uma vez). O arquivo não é guardado no app.
import { html } from '../dom.js';
import { icon } from '../icons.js';
import { openSheet, toast } from '../overlay.js';
import { formatInt } from '../../core/calc.js';
import { readPdf } from '../../services/pdf.js';
import { pickFile } from '../../services/files.js';
import { openBookForm } from './book-form.js';
import { openArticleForm } from './article-form.js';

/** as: 'livro' abre direto o formulário de livro; sem `as`, pergunta. */
export async function openPdfImport({ as = null } = {}) {
  const file = await pickFile('application/pdf,.pdf');
  if (!file) return;
  const dismiss = toast('Lendo o PDF…', { duration: 0 });
  let info;
  try {
    info = await readPdf(file);
  } catch (err) {
    dismiss();
    toast(err.message, { kind: 'error', duration: 6000 });
    return;
  }
  dismiss();

  const asBook = () => openBookForm({ data: { title: info.title, author: info.author, totalPages: info.pages, source: 'pdf' } });
  const asArticle = () =>
    openArticleForm({
      type: 'artigo',
      prefill: { title: info.title, site: info.author, words: info.words, pages: info.words ? null : info.pages, origin: `PDF de ${info.pages} pág.` },
    });
  if (as === 'livro') return asBook();

  const sheet = openSheet({
    title: 'PDF',
    className: 'sheet-small',
    content: html`<p style="margin-top:0"><b>${info.title}</b><br>
        <span class="small muted">${info.pages} páginas${info.words ? ` · ${formatInt(info.words)} palavras` : ''}${info.author ? ` · ${info.author}` : ''}</span></p>
      <div class="choice-list">
        <button type="button" class="choice" data-as="livro">
          <span class="type-dot livro">${icon('livro')}</span>
          <div><b>Livro</b><span>Acompanhar por página ("li até a página N")</span></div>
        </button>
        <button type="button" class="choice" data-as="artigo">
          <span class="type-dot artigo">${icon('artigo')}</span>
          <div><b>Artigo</b><span>Ler de uma vez; tempo ${info.words ? 'pelas palavras' : 'pelas páginas'}</span></div>
        </button>
      </div>`,
  });
  sheet.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-as]');
    if (!btn) return;
    sheet.close();
    if (btn.dataset.as === 'livro') asBook();
    else asArticle();
  });
}
