// Pedaços de interface reutilizados entre telas.
import { html, hueOf, initials } from './dom.js';
import { icon } from './icons.js';
import { formatDuration } from '../core/calc.js';
import { STATUS, TYPES } from '../core/progress.js';

export function cover(item, size = '') {
  if (item.type !== 'livro' && !item.coverUrl) return typeDot(item.type, size);
  const shape = item.type === 'livro' ? '' : 'thumb';
  return html`<div class="cover ${size} ${shape}" style="--hue:${hueOf(item.title)}" aria-hidden="true">
    ${initials(item.title)}${item.coverUrl ? html`<img src="${item.coverUrl}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
  </div>`;
}

export function typeDot(type) {
  return html`<span class="type-dot ${type}" aria-hidden="true">${icon(type)}</span>`;
}

export function statusBadge(status) {
  return html`<span class="badge ${status}">${STATUS[status] || status}</span>`;
}

export function percent(book) {
  if (!book.totalPages) return 0;
  return Math.min(100, Math.round((100 * (book.currentPage || 0)) / book.totalPages));
}

export function progressBar(book) {
  return html`<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent(book)}">
    <i style="width:${percent(book)}%"></i>
  </div>`;
}

export function subtitle(item) {
  if (item.type === 'livro') return item.author || 'Autor desconhecido';
  return item.site || TYPES[item.type];
}

/** Linha de item para listas (leva ao detalhe). */
export function itemRow(item, minutes) {
  const extra =
    item.type === 'livro' && item.status === 'lendo'
      ? html`<div class="row-sub">p. ${item.currentPage} de ${item.totalPages} · ${percent(item)}%</div>`
      : '';
  return html`<a class="row" href="#/item/${encodeURIComponent(item.id)}">
    ${cover(item)}
    <div class="row-main">
      <div class="row-title">${item.title}</div>
      <div class="row-sub">${subtitle(item)}</div>
      ${extra}
    </div>
    <div class="row-end">
      ${statusBadge(item.status)}
      ${minutes > 0 ? html`<div class="small muted">${formatDuration(minutes)}</div>` : ''}
    </div>
  </a>`;
}

/** Linha de entrada do histórico. dateLabel opcional aparece antes do detalhe. */
export function entryRow(entry, item, dateLabel = '') {
  const title = item ? item.title : 'Item apagado';
  const detail = [
    dateLabel,
    entry.pages != null
      ? `${entry.pages} pág.${entry.pageFrom != null ? ` (p. ${entry.pageFrom} → ${entry.pageTo})` : ''}`
      : item
        ? TYPES[item.type]
        : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return html`<button type="button" class="row" data-action="edit-entry" data-id="${entry.id}">
    ${item ? cover(item) : typeDot('artigo')}
    <div class="row-main">
      <div class="row-title">${title}</div>
      <div class="row-sub">${detail}</div>
    </div>
    <div class="row-end">+${formatDuration(entry.minutes)}</div>
  </button>`;
}
