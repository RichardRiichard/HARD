// "Li até a página N": registra o progresso de um livro.
import { html, $, setHtml } from '../dom.js';
import { openSheet } from '../overlay.js';
import { icon } from '../icons.js';
import { cover, progressBar } from '../components.js';
import { state } from '../../data/store.js';
import { applyProgress } from '../../core/progress.js';
import { displayMinutes } from '../../core/calc.js';
import { today, isValidDate } from '../../core/dates.js';
import { saveProgress, fixCurrentPage } from '../actions.js';

const STEPS = [5, 10, 20, 50];

export function openProgressSheet(book) {
  if (!book) return;
  const current = book.currentPage || 0;
  const sheet = openSheet({
    title: 'Atualizar página',
    content: html`<div class="detail-head" style="margin-bottom:14px">
        ${cover(book)}
        <div class="row-main">
          <div class="row-title">${book.title}</div>
          <div class="row-sub">Você está na página ${current} de ${book.totalPages}</div>
          ${progressBar(book)}
        </div>
      </div>
      <form novalidate>
        <label class="field"><span>Li até a página</span>
          <input name="page" inputmode="numeric" autocomplete="off" enterkeyhint="done" placeholder="${Math.min(current + 10, book.totalPages)}" autofocus>
        </label>
        <div class="btn-row" style="margin:-4px 0 14px">
          ${STEPS.filter((s) => current + s <= book.totalPages).map(
            (s) => html`<button type="button" class="chip" data-step="${s}">+${s}</button>`,
          )}
        </div>
        <div class="calc-preview" id="pg-preview">Digite a página em que parou.</div>
        <div id="pg-back"></div>
        <label class="field"><span>Data da leitura</span>
          <input type="date" name="date" value="${today()}" max="${today()}">
        </label>
        <div class="form-error" id="pg-error"></div>
        <div class="actions">
          <button type="button" class="btn" data-finish>${icon('check')} Terminei</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>`,
  });

  const form = $('form', sheet.body);
  const preview = $('#pg-preview', sheet.body);
  const back = $('#pg-back', sheet.body);
  const error = $('#pg-error', sheet.body);
  const pageInput = form.elements.page;

  function target() {
    const raw = pageInput.value.trim();
    return raw === '' ? null : Number(raw);
  }

  function update() {
    error.textContent = '';
    setHtml(back, '');
    const page = target();
    if (page === null) {
      preview.textContent = 'Digite a página em que parou.';
      return;
    }
    const r = applyProgress(book, page, { date: today(), settings: state.settings });
    if (r.ok) {
      setHtml(
        preview,
        html`${r.entry.pages} ${r.entry.pages === 1 ? 'página' : 'páginas'} · <b>+${displayMinutes(r.entry.minutes)} min</b>${r.item.status === 'lido' ? ' · livro concluído' : ''}`,
      );
    } else if (r.reason === 'backwards') {
      preview.textContent = `A página ${page} é menor que a atual (${current}).`;
      setHtml(
        back,
        html`<p class="hint" style="margin-top:0">Se a página atual estava errada, corrija sem registrar leitura:</p>
          <button type="button" class="btn btn-sm btn-block" data-fix="${page}" style="margin-bottom:14px">Corrigir página atual para ${page}</button>`,
      );
    } else if (r.reason === 'same') {
      preview.textContent = 'Essa já é a página atual.';
    } else if (r.reason === 'beyond') {
      preview.textContent = `O livro tem ${book.totalPages} páginas. Para mudar o total, edite os dados do livro.`;
    } else {
      preview.textContent = 'Digite um número de página válido.';
    }
  }

  async function submit(page) {
    const date = form.elements.date.value;
    if (!isValidDate(date)) {
      error.textContent = 'Informe uma data válida.';
      return;
    }
    const r = await saveProgress(book, page, date);
    if (r.ok) sheet.close();
    else update();
  }

  form.addEventListener('input', update);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const page = target();
    if (page === null) {
      error.textContent = 'Digite a página.';
      return;
    }
    submit(page);
  });
  sheet.body.addEventListener('click', async (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      pageInput.value = String(Math.min(current + Number(step.dataset.step), book.totalPages));
      update();
      return;
    }
    if (e.target.closest('[data-finish]')) {
      submit(book.totalPages);
      return;
    }
    const fix = e.target.closest('[data-fix]');
    if (fix) {
      await fixCurrentPage(book, Number(fix.dataset.fix));
      sheet.close();
    }
  });
}
