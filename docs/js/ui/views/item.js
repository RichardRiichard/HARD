// Detalhe de um livro, artigo ou post.
import { html, setHtml, onAction } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { cover, statusBadge, progressBar, percent, entryRow, subtitle } from '../components.js';
import { STATUS, TYPES, statusesFor } from '../../core/progress.js';
import { effectiveMinPerPage, formatDuration, formatDecimal, displayMinutes, bookMinutes } from '../../core/calc.js';
import { totalMinutes, totalPages } from '../../core/stats.js';
import { formatDateShort, today } from '../../core/dates.js';
import { confirmDialog } from '../overlay.js';
import { changeStatus, deleteItem, markRead, addManualEntry, saveProgress } from '../actions.js';
import { openArticleForm } from '../sheets/article-form.js';
import { openBookForm } from '../sheets/book-form.js';
import { openProgressSheet } from '../sheets/progress.js';

function stat(value, label) {
  return html`<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

function bookBody(book, entries) {
  const rate = effectiveMinPerPage(book, state.settings);
  const remaining = book.totalPages - (book.currentPage || 0);
  return html`
    <div class="card" style="margin-top:16px">
      <div class="chart-caption">
        <span>Página <b class="num">${book.currentPage || 0}</b> de <span class="num">${book.totalPages}</span></span>
        <b class="num">${percent(book)}%</b>
      </div>
      ${progressBar(book)}
      <p class="small muted" style="margin:6px 0 0">
        ${remaining > 0 ? `Faltam ${remaining} páginas (~${formatDuration(bookMinutes(remaining, rate))})` : 'Livro concluído'}
      </p>
      ${book.status !== 'lido' && remaining > 0
        ? html`<div class="btn-row" style="margin-top:12px">
            <button type="button" class="btn btn-primary" data-action="progress" style="flex:1">${icon('page')} Atualizar página</button>
            <button type="button" class="btn" data-action="finish">${icon('check')} Terminei</button>
          </div>`
        : ''}
    </div>
    <div class="stat-grid" style="margin-top:10px">
      ${stat(formatDuration(totalMinutes(entries)), 'tempo registrado')}
      ${stat(totalPages(entries), 'páginas registradas')}
      ${stat(`${formatDecimal(rate)} min`, book.minPerPage ? 'por página (deste livro)' : 'por página (padrão)')}
    </div>`;
}

function articleBody(item, entries) {
  return html`
    <div class="stat-grid" style="margin-top:16px">
      ${stat(`${formatDecimal(item.minutes)} min`, 'tempo estimado')}
      ${stat(formatDuration(totalMinutes(entries)), 'tempo registrado')}
      ${item.finishedOn ? stat(formatDateShort(item.finishedOn), 'lido em') : ''}
    </div>
    <div class="btn-row" style="margin-top:12px">
      ${item.status !== 'lido'
        ? html`<button type="button" class="btn btn-primary" data-action="mark-read" style="flex:1">${icon('check')} Marcar como lido</button>`
        : html`<button type="button" class="btn" data-action="reread" style="flex:1">${icon('plus')} Li de novo</button>`}
      ${item.url ? html`<a class="btn" href="${item.url}" target="_blank" rel="noopener noreferrer">${icon('external')} Abrir</a>` : ''}
    </div>`;
}

export default {
  title: 'Detalhes',
  tab: 'biblioteca',
  back: () => '#/biblioteca',
  render(main, id) {
    const item = store.getItem(id);
    if (!item) {
      setHtml(main, html`<div class="empty"><p>Item não encontrado.</p><a class="btn" href="#/biblioteca">Voltar à biblioteca</a></div>`);
      return;
    }
    const entries = store.sortedEntries(store.entriesOf(item.id));
    setHtml(
      main,
      html`<div class="detail-head">
          ${cover(item, 'lg')}
          <div class="row-main">
            <p class="small muted" style="margin:0 0 2px">${TYPES[item.type]}</p>
            <h2>${item.title}</h2>
            <p class="muted" style="margin:0 0 8px">${item.type === 'livro' ? subtitle(item) : item.site}</p>
            ${statusBadge(item.status)}
          </div>
        </div>
        ${item.type === 'livro' ? bookBody(item, entries) : articleBody(item, entries)}

        <div class="section">
          <label class="field"><span>Status</span>
            <select data-status>
              ${statusesFor(item.type).map((s) => html`<option value="${s}" ${s === item.status ? 'selected' : ''}>${STATUS[s]}</option>`)}
            </select>
          </label>
          <div class="btn-row">
            <button type="button" class="btn" data-action="edit" style="flex:1">${icon('edit')} Editar dados</button>
            <button type="button" class="btn btn-ghost danger" data-action="delete">${icon('trash')} Apagar</button>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h2>Registros de leitura</h2><span class="small muted">${entries.length}</span></div>
          ${entries.length
            ? html`<div class="list">${entries.map((e) => entryRow(e, item, formatDateShort(e.date)))}</div>`
            : html`<div class="empty"><p>Nenhuma leitura registrada ainda.</p></div>`}
        </div>`,
    );

    onAction(main, {
      'mark-read': () => markRead(item),
      reread: async () => {
        const ok = await confirmDialog({
          title: 'Li de novo',
          message: `Registrar mais ${displayMinutes(item.minutes)} min de leitura hoje?`,
          confirmLabel: 'Registrar',
        });
        if (ok) await addManualEntry(item, { date: today(), minutes: item.minutes });
      },
      edit: () => this.openEdit(item),
      delete: async () => {
        const n = entries.length;
        const ok = await confirmDialog({
          title: 'Apagar item',
          message: n
            ? `Apagar "${item.title}" e ${n === 1 ? 'seu registro de leitura' : `seus ${n} registros de leitura`}? O tempo deles sai do total.`
            : `Apagar "${item.title}"?`,
          confirmLabel: 'Apagar',
          danger: true,
        });
        if (!ok) return;
        await deleteItem(item);
        location.hash = '#/biblioteca';
      },
      'edit-entry': (el) => this.openEntry(el.dataset.id),
      progress: () => openProgressSheet(item),
      finish: () => this.finish(item),
    });

    const select = main.querySelector('[data-status]');
    select.addEventListener('change', () => this.onStatus(item, select));
  },

  async onStatus(item, select) {
    const status = select.value;
    if (status === item.status) return;
    if (status === 'lido' && item.type !== 'livro') return markRead(item);
    if (status === 'lido' && item.type === 'livro' && item.currentPage < item.totalPages) {
      const done = await this.finish(item, true);
      if (!done) select.value = item.status;
      return;
    }
    await changeStatus(item, status);
  },

  /** Retorna true se algo foi registrado/alterado. */
  async finish(book, fromSelect = false) {
    const remaining = book.totalPages - (book.currentPage || 0);
    const minutes = bookMinutes(remaining, effectiveMinPerPage(book, state.settings));
    const ok = await confirmDialog({
      title: 'Terminei',
      message: `Registrar as ${remaining} páginas restantes (+${displayMinutes(minutes)} min) e marcar como lido?`,
      confirmLabel: 'Registrar e concluir',
      cancelLabel: fromSelect ? 'Só mudar o status' : 'Cancelar',
    });
    if (ok) {
      await saveProgress(book, book.totalPages);
      return true;
    }
    if (fromSelect && ok === false) {
      await changeStatus(book, 'lido');
      return true;
    }
    return false;
  },

  openEdit(item) {
    if (item.type === 'livro') openBookForm({ item });
    else openArticleForm({ item });
  },
  openEntry() {},
};
