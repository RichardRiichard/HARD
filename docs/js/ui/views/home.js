// Tela inicial: tempo total, semana, sequência, livros em andamento e atalhos.
import { html, setHtml, onAction } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { formatDuration, formatDecimal, splitHours } from '../../core/calc.js';
import { minutesThisWeek, streak, totalMinutes } from '../../core/stats.js';
import { today, formatDayRelative } from '../../core/dates.js';
import { cover, progressBar, percent, subtitle, entryRow, typeDot } from '../components.js';
import { openAddChooser } from '../sheets/add.js';
import { markRead } from '../actions.js';
import { openProgressSheet } from '../sheets/progress.js';
import { openEntrySheet } from '../sheets/entry.js';

export function hero() {
  const t = today();
  const total = splitHours(totalMinutes(state.entries));
  const week = minutesThisWeek(state.entries, t);
  const s = streak(state.entries, t);
  return html`<section class="hero" id="hero">
    <div class="hero-label">Tempo total lido</div>
    <div class="hero-total" aria-label="${total.h} horas e ${total.m} minutos">
      <b>${total.h}</b><span>h</span><b>${total.m}</b><span>min</span>
    </div>
    <div class="hero-meta">
      <div>${icon('history')} Esta semana: <strong>${formatDuration(week)}</strong></div>
      <div>${icon('flame')} ${s.current === 1 ? '1 dia seguido' : `${s.current} dias seguidos`}</div>
    </div>
  </section>`;
}

function readingSection() {
  const books = state.items
    .filter((i) => i.type === 'livro' && i.status === 'lendo')
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  if (!books.length) return '';
  return html`<section class="section">
    <div class="section-head"><h2>Lendo agora</h2></div>
    <div class="list">
      ${books.map(
        (b) => html`<div class="card reading-card">
          <a href="#/item/${encodeURIComponent(b.id)}">${cover(b)}</a>
          <div class="row-main">
            <a href="#/item/${encodeURIComponent(b.id)}" class="row-title" style="color:inherit;text-decoration:none">${b.title}</a>
            <div class="row-sub">${subtitle(b)}</div>
            ${progressBar(b)}
            <div class="row-sub num">p. ${b.currentPage} de ${b.totalPages} · ${percent(b)}%</div>
            <button type="button" class="btn btn-sm btn-primary" data-action="progress" data-id="${b.id}" style="margin-top:8px">${icon('page')} Atualizar página</button>
          </div>
        </div>`,
      )}
    </div>
  </section>`;
}

function wantSection() {
  const items = state.items
    .filter((i) => i.type !== 'livro' && i.status === 'quero')
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  if (!items.length) return '';
  return html`<section class="section">
    <div class="section-head"><h2>Artigos para ler</h2>${items.length > 3 ? html`<a href="#/biblioteca/quero">Ver todos (${items.length})</a>` : ''}</div>
    <div class="list">
      ${items.slice(0, 3).map(
        (a) => html`<div class="row">
          ${typeDot(a.type)}
          <a class="row-main" href="#/item/${encodeURIComponent(a.id)}" style="color:inherit;text-decoration:none">
            <div class="row-title">${a.title}</div>
            <div class="row-sub">${subtitle(a)} · ${formatDecimal(a.minutes)} min</div>
          </a>
          <button type="button" class="btn btn-sm" data-action="mark-read" data-id="${a.id}" aria-label="Marcar como lido">${icon('check')} Lido</button>
        </div>`,
      )}
    </div>
  </section>`;
}

function recentSection() {
  const entries = store.sortedEntries().slice(0, 5);
  if (!entries.length) return '';
  const byId = store.itemsById();
  const t = today();
  return html`<section class="section">
    <div class="section-head"><h2>Últimos registros</h2><a href="#/historico">Ver histórico</a></div>
    <div class="list">
      ${entries.map((e) => entryRow(e, byId.get(e.itemId), formatDayRelative(e.date, t)))}
    </div>
  </section>`;
}

function welcome() {
  if (state.items.length) return '';
  return html`<div class="section empty">
    <p><b>Bem-vindo!</b></p>
    <p>Registre livros, artigos e posts que você lê. O app soma o tempo estimado de leitura, sem cronômetro.</p>
  </div>`;
}

export default {
  title: 'Leituras',
  tab: 'inicio',
  render(main) {
    setHtml(
      main,
      html`${hero()}
        <div class="section" style="margin-top:16px">
          <button type="button" class="btn btn-primary btn-big" data-action="add">${icon('plus')} Adicionar leitura</button>
        </div>
        ${welcome()}
        ${readingSection()}
        ${wantSection()}
        ${recentSection()}`,
    );
    onAction(main, {
      add: () => openAddChooser(),
      progress: (el) => openProgressSheet(store.getItem(el.dataset.id)),
      'mark-read': (el) => markRead(store.getItem(el.dataset.id)),
      'edit-entry': (el) => openEntrySheet(el.dataset.id),
    });
  },
};
