// Editar ou apagar um registro de leitura (data, páginas, minutos).
import { html, $ } from '../dom.js';
import { openSheet, confirmDialog } from '../overlay.js';
import { icon } from '../icons.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { TYPES } from '../../core/progress.js';
import { bookMinutes, effectiveMinPerPage, parseDecimal, formatDecimal, displayMinutes } from '../../core/calc.js';
import { today, isValidDate } from '../../core/dates.js';
import { updateEntry, deleteEntry } from '../actions.js';

export function openEntrySheet(entryId) {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return;
  const item = store.getItem(entry.itemId);
  const isBookRange = item?.type === 'livro' && entry.pageFrom != null;

  const sheet = openSheet({
    title: 'Editar registro',
    content: html`<p style="margin:0 0 14px"><b>${item ? item.title : 'Item apagado'}</b><br>
        <span class="small muted">${item ? TYPES[item.type] : ''}</span></p>
      <form novalidate>
        <label class="field"><span>Data</span>
          <input type="date" name="date" value="${entry.date}" max="${today()}">
          <small>Mude a data para registrar uma leitura passada.</small>
        </label>
        ${isBookRange
          ? html`<label class="field"><span>Páginas lidas</span>
              <input name="pages" inputmode="numeric" autocomplete="off" value="${entry.pages}">
              <small id="en-range"></small>
            </label>`
          : ''}
        <label class="field"><span>Minutos</span>
          <input name="minutes" inputmode="decimal" autocomplete="off" value="${formatDecimal(entry.minutes)}">
          ${isBookRange ? html`<small>Recalculado ao mudar as páginas. Você pode ajustar à mão.</small>` : ''}
        </label>
        <div class="form-error" id="en-error"></div>
        <div class="actions">
          <button type="button" class="btn btn-ghost danger" data-delete>${icon('trash')} Apagar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>`,
  });

  const form = $('form', sheet.body);
  const error = $('#en-error', sheet.body);
  const range = $('#en-range', sheet.body);
  const rate = item ? effectiveMinPerPage(item, state.settings) : 0;

  function showRange() {
    if (!range) return;
    const pages = Number(form.elements.pages.value);
    range.textContent = Number.isInteger(pages) && pages >= 0 ? `p. ${entry.pageFrom} → ${entry.pageFrom + pages}` : '';
  }
  if (isBookRange) {
    showRange();
    form.elements.pages.addEventListener('input', () => {
      showRange();
      const pages = Number(form.elements.pages.value);
      if (Number.isInteger(pages) && pages >= 0) form.elements.minutes.value = formatDecimal(bookMinutes(pages, rate));
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = form.elements.date.value;
    const minutes = parseDecimal(form.elements.minutes.value);
    if (!isValidDate(date)) {
      error.textContent = 'Informe uma data válida.';
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 0) {
      error.textContent = 'Minutos inválidos.';
      return;
    }
    const patch = { date, minutes };
    if (isBookRange) patch.pages = Number(form.elements.pages.value.trim());
    const r = await updateEntry(entry, patch);
    if (r.ok) sheet.close();
    else
      error.textContent =
        r.reason === 'beyond' ? `Passa do total do livro (${item.totalPages} páginas).` : 'Páginas inválidas (use um número inteiro).';
  });

  $('[data-delete]', sheet.body).addEventListener('click', async () => {
    const revert =
      item?.type === 'livro' && entry.pageTo != null && entry.pageTo === item.currentPage
        ? `\nA página atual do livro volta para ${entry.pageFrom}.`
        : '';
    const ok = await confirmDialog({
      title: 'Apagar registro',
      message: `Apagar este registro? Sai ${displayMinutes(entry.minutes)} min do total.${revert}`,
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    await deleteEntry(entry);
    sheet.close();
  });
}
