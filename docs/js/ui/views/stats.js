// Estatísticas: total, médias (dia e semana), por tipo, onde foi o tempo e concluídos.
import { html, setHtml, $, onAction } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { formatDuration, formatDecimal, formatInt, splitHours } from '../../core/calc.js';
import {
  totalMinutes,
  totalPages,
  minutesByType,
  weeklyAverageThisYear,
  pace,
  topItems,
  topSources,
  entriesInPeriod,
  completedSummary,
} from '../../core/stats.js';
import { today, yearKey } from '../../core/dates.js';
const TYPE_PLURAL = { livro: 'Livros', artigo: 'Artigos', blog: 'Posts de blog' };

function stat(value, label, extra = '') {
  return html`<div class="stat"><b>${value}${extra}</b><span>${label}</span></div>`;
}

/** Variação pequena ao lado da média: ▲ verde quando subiu, ▼ vermelho quando caiu. */
function trend(changePct) {
  if (changePct === null || changePct === 0) return '';
  const up = changePct > 0;
  return html` <span class="trend ${up ? 'up' : 'down'}" title="em relação aos 30 dias anteriores">${up ? '▲' : '▼'} ${Math.abs(changePct)}%</span>`;
}

function typeBars() {
  const by = minutesByType(state.entries, store.itemsById());
  const total = by.livro + by.artigo + by.blog;
  return html`<div class="type-bars">
    ${Object.keys(by).map((type) => {
      const pct = total ? Math.round((100 * by[type]) / total) : 0;
      return html`<div>
        <div class="type-bar-label">
          <span><span class="swatch" style="--c:var(--type-${type})"></span>${TYPE_PLURAL[type]}</span>
          <span><b>${formatDuration(by[type])}</b> <span class="muted">· ${pct}%</span></span>
        </div>
        <div class="type-bar" style="--c:var(--type-${type})"><i style="width:${total ? (100 * by[type]) / total : 0}%"></i></div>
      </div>`;
    })}
  </div>`;
}

function doneTable(t) {
  const s = completedSummary(state.items, t);
  const cols = [
    ['semana', 'Semana'],
    ['mes', 'Mês'],
    ['ano', 'Ano'],
    ['total', 'Total'],
  ];
  return html`<table class="done-table">
    <thead><tr><th></th>${cols.map(([, label]) => html`<th>${label}</th>`)}</tr></thead>
    <tbody>
      <tr><td>Livros</td>${cols.map(([k]) => html`<td>${s[k].livros}</td>`)}</tr>
      <tr><td>Artigos e posts</td>${cols.map(([k]) => html`<td>${s[k].artigos}</td>`)}</tr>
    </tbody>
  </table>`;
}

const WHERE_PERIODS = { '30d': '30 dias', ano: 'Este ano', sempre: 'Sempre' };
const WHERE_TABS = { leituras: 'Leituras', autor: 'Autores', site: 'Sites' };
const where = { period: 'sempre', tab: 'leituras', expanded: false };
const TYPE_LABEL = { livro: 'Livro', artigo: 'Artigo', blog: 'Post' };

function rankList(rows, total) {
  if (!rows.length) return html`<p class="small muted" style="margin:0">Nada neste período.</p>`;
  const max = rows[0].minutes || 1;
  return html`<div class="type-bars">
    ${rows.map((r, i) => {
      const pct = total ? Math.round((100 * r.minutes) / total) : 0;
      const sub = r.type ? TYPE_LABEL[r.type] : `${r.items} ${r.items === 1 ? 'leitura' : 'leituras'}`;
      return html`<div>
        <div class="type-bar-label">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="muted num">${i + 1}.</span> ${r.label}</span>
          <span style="flex:none"><b>${formatDuration(r.minutes)}</b> <span class="muted">· ${pct}%</span></span>
        </div>
        <div class="type-bar" style="--c:var(--accent)"><i style="width:${(100 * r.minutes) / max}%"></i></div>
        <div class="small muted" style="margin-top:2px">${sub}</div>
      </div>`;
    })}
  </div>`;
}

function whereSection(t) {
  const byId = store.itemsById();
  const entries = entriesInPeriod(state.entries, where.period, t);
  const total = totalMinutes(entries);
  const limit = where.expanded ? 50 : 10;
  const rows = where.tab === 'leituras' ? topItems(entries, byId, limit) : topSources(entries, byId, where.tab, limit);
  const all = where.tab === 'leituras' ? topItems(entries, byId, 1e6) : topSources(entries, byId, where.tab, 1e6);
  const distinct = new Set(entries.map((e) => e.itemId)).size;
  const seg = (group, options, active) => html`<div class="seg" role="group" style="margin-bottom:8px">
    ${Object.entries(options).map(
      ([k, label]) => html`<button type="button" data-action="where" data-group="${group}" data-value="${k}" aria-pressed="${String(k === active)}">${label}</button>`,
    )}
  </div>`;
  return html`<section class="section card" id="where">
    <div class="section-head"><h2>Onde foi seu tempo</h2></div>
    ${seg('period', WHERE_PERIODS, where.period)}
    ${seg('tab', WHERE_TABS, where.tab)}
    <p class="small muted" style="margin:4px 0 12px">${formatDuration(total)} em ${distinct} ${distinct === 1 ? 'leitura' : 'leituras'}${
      where.tab !== 'leituras' ? ` · ${all.length} ${where.tab === 'autor' ? (all.length === 1 ? 'autor' : 'autores') : all.length === 1 ? 'site' : 'sites'}` : ''
    }</p>
    ${rankList(rows, total)}
    ${all.length > 10
      ? html`<button type="button" class="link-btn" data-action="where-more" style="margin-top:12px">${where.expanded ? 'Mostrar menos' : `Ver todos (${all.length})`}</button>`
      : ''}
  </section>`;
}

export default {
  title: 'Estatísticas',
  tab: 'estatisticas',
  render(main) {
    if (!state.entries.length) {
      setHtml(
        main,
        html`<div class="empty section"><p>As estatísticas aparecem depois do primeiro registro de leitura.</p>
          <a class="btn btn-primary" href="#/inicio">${icon('plus')} Registrar leitura</a></div>`,
      );
      return;
    }
    const t = today();
    const total = splitHours(totalMinutes(state.entries));
    const p = pace(state.entries, t, 30);
    const w = weeklyAverageThisYear(state.entries, t);

    setHtml(
      main,
      html`<section class="hero">
          <div class="hero-label">Tempo total lido</div>
          <div class="hero-total" aria-label="${total.h} horas e ${total.m} minutos">
            <b>${total.h}</b><span>h</span><b>${total.m}</b><span>min</span>
          </div>
          <div class="hero-meta"><div>${state.entries.length} registros de leitura</div></div>
        </section>

        <div class="stat-grid stat-grid-2" style="margin-top:10px">
          ${stat(`${formatDecimal(p.perDay, 0)} min`, 'por dia, média de 30 dias', trend(p.changePct))}
          ${stat(formatDuration(w.perWeek), `por semana, média de ${yearKey(t)}`)}
          <div class="stat stat-wide"><b>${formatInt(totalPages(state.entries))}</b><span>páginas lidas</span></div>
        </div>

        <section class="section card">
          <div class="section-head"><h2>Tempo por tipo</h2></div>
          ${typeBars()}
        </section>

        ${whereSection(t)}

        <section class="section card">
          <div class="section-head"><h2>Concluídos</h2></div>
          ${doneTable(t)}
        </section>`,
    );

    onAction(main, {
      where: (el) => {
        where[el.dataset.group] = el.dataset.value;
        where.expanded = false;
        this.render(main);
      },
      'where-more': () => {
        where.expanded = !where.expanded;
        this.render(main);
      },
    });
  },
};
