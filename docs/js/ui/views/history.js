// Histórico: todas as entradas agrupadas por dia, com edição.
import { html, setHtml, onAction } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { entryRow } from '../components.js';
import { formatDuration } from '../../core/calc.js';
import { totalMinutes } from '../../core/stats.js';
import { today, formatDayRelative } from '../../core/dates.js';
import { openEntrySheet } from '../sheets/entry.js';
import { openAddChooser } from '../sheets/add.js';

const PAGE_DAYS = 30;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
let visibleDays = PAGE_DAYS;

function groups(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return [...map.entries()];
}

export default {
  title: 'Histórico',
  tab: 'historico',
  render(main) {
    const entries = store.sortedEntries();
    if (!entries.length) {
      setHtml(
        main,
        html`<div class="empty section">
          <p>Nenhuma leitura registrada ainda.</p>
          <p class="small">Cada vez que você marca algo como lido ou atualiza a página de um livro, um registro aparece aqui.</p>
          <button type="button" class="btn btn-primary" data-action="add">${icon('plus')} Adicionar leitura</button>
        </div>`,
      );
      onAction(main, { add: () => openAddChooser() });
      return;
    }
    const byId = store.itemsById();
    const all = groups(entries);
    const shown = all.slice(0, visibleDays);
    const t = today();
    setHtml(
      main,
      html`<p class="small muted" style="margin:4px 2px 14px">
          ${state.entries.length} ${state.entries.length === 1 ? 'registro' : 'registros'} · ${formatDuration(totalMinutes(state.entries))} no total. Toque num registro para editar a data, as páginas ou os minutos.
        </p>
        ${shown.map(
          ([date, list]) => html`<section class="day-group">
            <div class="day-head"><span>${capitalize(formatDayRelative(date, t))}</span><span class="num">${formatDuration(totalMinutes(list))}</span></div>
            <div class="list">${list.map((e) => entryRow(e, byId.get(e.itemId)))}</div>
          </section>`,
        )}
        ${all.length > shown.length
          ? html`<div class="section"><button type="button" class="btn btn-block" data-action="more">Mostrar dias anteriores</button></div>`
          : ''}`,
    );
    onAction(main, {
      'edit-entry': (el) => openEntrySheet(el.dataset.id),
      more: () => {
        visibleDays += PAGE_DAYS;
        this.render(main);
      },
    });
  },
};
