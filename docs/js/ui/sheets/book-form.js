// Formulário de livro: dados (vindos da busca ou manuais) e situação inicial.
import { html, $, formValues, setHtml } from '../dom.js';
import { openSheet } from '../overlay.js';
import { cover } from '../components.js';
import { state } from '../../data/store.js';
import { parseDecimal, bookMinutes, displayMinutes, formatDecimal } from '../../core/calc.js';
import { createBook } from '../../core/progress.js';
import { today, isValidDate } from '../../core/dates.js';
import { addBook, saveItem } from '../actions.js';
import { icon } from '../icons.js';
import { pickFile } from '../../services/files.js';
import { imageFileToCover } from '../../services/images.js';

/**
 * data: dados iniciais (resultado da busca) para um livro novo.
 * item: livro existente para edição.
 */
export function openBookForm({ data = {}, item = null } = {}) {
  const editing = Boolean(item);
  const src = item || data;
  const defaultRate = formatDecimal(state.settings.minPerPage);

  const sheet = openSheet({
    title: editing ? 'Editar livro' : 'Adicionar livro',
    content: html`<form novalidate>
      <div class="detail-head" style="margin-bottom:14px">
        <div id="bf-cover">${cover({ type: 'livro', title: src.title || '?', coverUrl: src.coverUrl })}</div>
        <div class="row-main">
          <label class="field"><span>Título</span>
            <input name="title" required autocomplete="off" value="${src.title || ''}" ${src.title ? '' : 'autofocus'}>
          </label>
        </div>
      </div>
      <label class="field"><span>Autor</span>
        <input name="author" autocomplete="off" value="${src.author || ''}">
      </label>
      <div class="row-2">
        <label class="field"><span>Total de páginas</span>
          <input name="totalPages" inputmode="numeric" autocomplete="off" value="${src.totalPages || ''}" placeholder="Ex.: 240">
        </label>
        <label class="field"><span>Min/página deste livro</span>
          <input name="minPerPage" inputmode="decimal" autocomplete="off" value="${src.minPerPage ? formatDecimal(src.minPerPage) : ''}" placeholder="padrão: ${defaultRate}">
        </label>
      </div>
      <p class="hint">Deixe o min/página vazio para usar o padrão. Livros técnicos ou devocionais costumam pedir mais (ex.: 2,5).${editing ? ' Vale para os próximos registros.' : ''}</p>
      ${!src.totalPages && !editing ? html`<p class="hint">A busca não informou o total de páginas. Confira na sua edição.</p>` : ''}
      <div class="btn-row" style="margin:-4px 0 14px">
        <button type="button" class="btn btn-sm" data-cover style="flex:1">${icon('upload')} ${src.coverUrl ? 'Trocar capa' : 'Escolher foto da capa'}</button>
        <button type="button" class="btn btn-sm btn-ghost danger" data-cover-remove ${src.coverUrl ? '' : 'hidden'}>Remover capa</button>
      </div>
      ${editing
        ? ''
        : html`<div class="field">
            <span class="field-label">Situação</span>
            <div class="seg" role="radiogroup">
              <label><input type="radio" name="status" value="lido" checked>Já li</label>
              <label><input type="radio" name="status" value="lendo">Lendo</label>
              <label><input type="radio" name="status" value="quero">Quero ler</label>
            </div>
          </div>
          <div data-show="lendo">
            <label class="field"><span>Estou na página</span>
              <input name="startPage" inputmode="numeric" autocomplete="off" value="0">
            </label>
          </div>
          <div data-show="lendo lido">
            <label class="check" data-show-count><input type="checkbox" name="countPages" checked><span id="bf-count-label"></span></label>
            <label class="field" data-show-count><span id="bf-date-label">Data da leitura</span>
              <input type="date" name="date" value="${today()}" max="${today()}">
              <small>Use a data aproximada. Ela define em que semana e mês esse tempo entra.</small>
            </label>
          </div>`}
      <div class="form-error" id="bf-error"></div>
      <div class="actions">
        <button type="submit" class="btn btn-primary btn-block">${editing ? 'Salvar' : 'Adicionar livro'}</button>
      </div>
    </form>`,
  });

  const form = $('form', sheet.body);
  const error = $('#bf-error', sheet.body);

  function read() {
    const v = formValues(form);
    const rate = parseDecimal(v.minPerPage);
    return {
      v,
      title: v.title.trim(),
      totalPages: Number(String(v.totalPages).trim()),
      minPerPage: Number.isFinite(rate) && rate > 0 ? rate : null,
      startPage: Number(String(v.startPage ?? '0').trim() || 0),
    };
  }

  function update() {
    if (editing) return;
    const { v, totalPages, minPerPage, startPage } = read();
    for (const el of form.querySelectorAll('[data-show]')) el.hidden = !el.dataset.show.split(' ').includes(v.status);
    const pages = v.status === 'lido' ? totalPages : startPage;
    const valid = Number.isInteger(pages) && pages > 0;
    const minutes = valid ? bookMinutes(pages, minPerPage || state.settings.minPerPage) : 0;
    for (const el of form.querySelectorAll('[data-show-count]')) el.hidden = !valid;
    $('#bf-count-label', form).textContent = valid
      ? `Contar ${v.status === 'lido' ? 'as' : 'essas'} ${pages} páginas no meu tempo (+${displayMinutes(minutes)} min)`
      : '';
    $('#bf-date-label', form).textContent = v.status === 'lido' ? 'Terminei em' : 'Data da leitura';
    form.elements.date.closest('label').hidden = !valid || !v.countPages;
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  // Capa: da busca/PDF, ou foto escolhida pelo usuário (reduzida e guardada no app).
  let coverUrl = src.coverUrl || '';
  const showCover = () => {
    setHtml($('#bf-cover', form), cover({ type: 'livro', title: form.elements.title.value || '?', coverUrl }));
    $('[data-cover-remove]', form).hidden = !coverUrl;
  };
  $('[data-cover]', form).addEventListener('click', async () => {
    try {
      const file = await pickFile('image/*');
      if (!file) return;
      coverUrl = await imageFileToCover(file);
      showCover();
    } catch (err) {
      error.textContent = err.message;
    }
  });
  $('[data-cover-remove]', form).addEventListener('click', () => {
    coverUrl = '';
    showCover();
  });
  update();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { v, title, totalPages, minPerPage, startPage } = read();
    let message = '';
    if (!title) message = 'Informe o título.';
    else if (!Number.isInteger(totalPages) || totalPages < 1) message = 'Informe o total de páginas (número inteiro).';
    else if (v.minPerPage.trim() && !minPerPage) message = 'Min/página inválido. Use um número como 1,5.';
    else if (editing && totalPages < (item.currentPage || 0))
      message = `O total não pode ser menor que a página atual (${item.currentPage}).`;
    else if (!editing && v.status === 'lendo' && (!Number.isInteger(startPage) || startPage < 0 || startPage > totalPages))
      message = 'Página atual inválida.';
    else if (!editing && v.status !== 'quero' && v.countPages && !isValidDate(v.date)) message = 'Informe uma data válida.';
    error.textContent = message;
    if (message) return;

    try {
      if (editing) {
        const finished = item.currentPage === totalPages;
        await saveItem({
          ...item,
          title,
          author: v.author.trim(),
          totalPages,
          minPerPage,
          coverUrl,
          ...(finished && item.status === 'lendo' ? { status: 'lido', finishedOn: today() } : {}),
        });
      } else {
        const book = createBook({ ...data, title, author: v.author.trim(), totalPages, minPerPage, coverUrl });
        await addBook(book, {
          status: v.status,
          startPage,
          countPages: v.countPages,
          date: v.countPages ? v.date : today(),
        });
      }
      sheet.close();
    } catch (err) {
      error.textContent = err.message;
    }
  });
}
