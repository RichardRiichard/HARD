// Biblioteca: livros, artigos e blogs com filtros por tipo, status e busca.
import { html, setHtml, $, onAction } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../../data/store.js';
import { itemRow } from '../components.js';
import { openAddChooser } from '../sheets/add.js';

const TYPE_FILTERS = { todos: 'Tudo', livro: 'Livros', artigo: 'Artigos', blog: 'Blogs' };
const STATUS_FILTERS = { todos: 'Qualquer status', lendo: 'Lendo', quero: 'Quero ler', lido: 'Lidos', abandonado: 'Abandonados' };

const filters = { type: 'todos', status: 'todos', q: '' };

function normalize(s) {
  return String(s || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function filtered() {
  const q = normalize(filters.q.trim());
  const order = { lendo: 0, quero: 1, lido: 2, abandonado: 3 };
  return state.items
    .filter((i) => filters.type === 'todos' || i.type === filters.type)
    .filter((i) => filters.status === 'todos' || i.status === filters.status)
    .filter((i) => !q || normalize(`${i.title} ${i.author || ''} ${i.site || ''}`).includes(q))
    .sort((a, b) => order[a.status] - order[b.status] || (b.updatedAt > a.updatedAt ? 1 : -1));
}

function minutesByItem() {
  const map = new Map();
  for (const e of state.entries) map.set(e.itemId, (map.get(e.itemId) || 0) + (Number(e.minutes) || 0));
  return map;
}

function listHtml() {
  const items = filtered();
  if (!state.items.length) {
    return html`<div class="empty">
      <p>Nada por aqui ainda.</p>
      <button type="button" class="btn btn-primary" data-action="add">${icon('plus')} Adicionar leitura</button>
    </div>`;
  }
  if (!items.length) return html`<div class="empty"><p>Nenhum item com esses filtros.</p></div>`;
  const minutes = minutesByItem();
  return html`<p class="small muted">${items.length === 1 ? '1 item' : `${items.length} itens`}</p>
    <div class="list">${items.map((i) => itemRow(i, minutes.get(i.id) || 0))}</div>`;
}

function chips(group, options, active) {
  return html`<div class="chips" role="group">
    ${Object.entries(options).map(
      ([key, label]) =>
        html`<button type="button" class="chip" data-action="filter" data-group="${group}" data-value="${key}" aria-pressed="${String(key === active)}">${label}</button>`,
    )}
  </div>`;
}

export default {
  title: 'Biblioteca',
  tab: 'biblioteca',
  render(main, param) {
    if (param && (param in STATUS_FILTERS || param in TYPE_FILTERS)) {
      Object.assign(filters, { type: 'todos', status: 'todos', q: '' });
      if (param in STATUS_FILTERS) filters.status = param;
      else filters.type = param;
      history.replaceState(null, '', '#/biblioteca');
    }
    setHtml(
      main,
      html`<div class="search-bar">
          <input type="search" id="lib-q" placeholder="Buscar por título, autor ou site" value="${filters.q}" aria-label="Buscar na biblioteca">
          <button type="button" class="btn btn-primary" data-action="add" aria-label="Adicionar leitura">${icon('plus')}</button>
        </div>
        ${chips('type', TYPE_FILTERS, filters.type)}
        <div style="height:8px"></div>
        ${chips('status', STATUS_FILTERS, filters.status)}
        <div class="section" id="lib-list" style="margin-top:14px">${listHtml()}</div>`,
    );
    onAction(main, {
      add: () => openAddChooser(),
      filter: (el) => {
        filters[el.dataset.group] = el.dataset.value;
        this.render(main);
      },
    });
    $('#lib-q', main).addEventListener('input', (e) => {
      filters.q = e.target.value;
      setHtml($('#lib-list', main), listHtml());
    });
  },
};
