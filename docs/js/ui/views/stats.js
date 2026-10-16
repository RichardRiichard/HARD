// Estatísticas: total, ritmo, por tipo, por semana/mês, páginas, onde foi o tempo e concluídos.
import { html, setHtml, $, onAction } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { formatDuration, formatDecimal, formatInt, splitHours } from '../../core/calc.js';
import {
  totalMinutes,
  totalPages,
  minutesByType,
  byWeek,
  byMonth,
  pace,
  topItems,
  topSources,
  entriesInPeriod,
  completedSummary,
} from '../../core/stats.js';
import { today, addDays, formatWeekShort, formatMonthShort, formatMonthLong, formatDateShort } from '../../core/dates.js';
import { barChart, bindChart } from '../chart.js';

let period = 'semana';
const TYPE_PLURAL = { livro: 'Livros', artigo: 'Artigos', blog: 'Posts de blog' };

function axisMinutes(v) {
  if (v === 0) return '0';
  if (v < 60) return `${v} min`;
  return `${formatDecimal(v / 60, 1)} h`;
}

function stat(value, label) {
  return html`<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

/** Ponto de série: label (eixo), value, name (período por extenso), text (valor formatado). */
function point(label, value, name, text) {
  return { label, value, name, text, tip: `${name}: ${text}` };
}

function timeSeries(t) {
  const text = (b) => `${formatDuration(b.minutes)}${b.pages ? ` · ${formatInt(b.pages)} pág.` : ''}`;
  if (period === 'semana') {
    return byWeek(state.entries, t, 12).map((w) =>
      point(formatWeekShort(w.key), w.minutes, `Semana de ${formatDateShort(w.key)} a ${formatDateShort(addDays(w.key, 6))}`, text(w)),
    );
  }
  return byMonth(state.entries, t, 12).map((m) => point(formatMonthShort(m.key), m.minutes, formatMonthLong(m.key), text(m)));
}

function pageSeries(t) {
  return byMonth(state.entries, t, 12).map((m) =>
    point(formatMonthShort(m.key), m.pages, formatMonthLong(m.key), `${formatInt(m.pages)} páginas`),
  );
}

function dataTable(series, header) {
  return html`<details class="small" style="margin-top:8px">
    <summary class="muted">Ver em tabela</summary>
    <table class="done-table" style="margin-top:6px">
      <thead><tr><th>${header}</th><th>Valor</th></tr></thead>
      <tbody>${[...series].reverse().map((d) => html`<tr><td>${d.name}</td><td>${d.text}</td></tr>`)}</tbody>
    </table>
  </details>`;
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
    const series = timeSeries(t);
    const pages = pageSeries(t);

    setHtml(
      main,
      html`<section class="hero">
          <div class="hero-label">Tempo total lido</div>
          <div class="hero-total" aria-label="${total.h} horas e ${total.m} minutos">
            <b>${total.h}</b><span>h</span><b>${total.m}</b><span>min</span>
          </div>
          <div class="hero-meta"><div>${state.entries.length} registros de leitura</div></div>
        </section>

        <div class="stat-grid" style="margin-top:10px">
          ${stat(`${formatDecimal(p.perDay, 0)} min`, 'por dia, média de 30 dias')}
          ${stat(p.changePct === null ? '—' : `${p.changePct > 0 ? '+' : p.changePct < 0 ? '−' : ''}${Math.abs(p.changePct)}%`, p.changePct === null ? 'sem dados dos 30 dias anteriores' : 'vs. 30 dias anteriores')}
          ${stat(formatInt(totalPages(state.entries)), 'páginas lidas')}
        </div>

        <section class="section card">
          <div class="section-head"><h2>Tempo por tipo</h2></div>
          ${typeBars()}
        </section>

        <section class="section card">
          <div class="section-head">
            <h2>Tempo por ${period === 'semana' ? 'semana' : 'mês'}</h2>
          </div>
          <div class="seg" role="group" aria-label="Período" style="margin-bottom:12px">
            <button type="button" data-action="period" data-value="semana" aria-pressed="${String(period === 'semana')}">Semanas</button>
            <button type="button" data-action="period" data-value="mes" aria-pressed="${String(period === 'mes')}">Meses</button>
          </div>
          <div id="chart-time">${barChart(series, { kind: 'minutes', axisFormat: axisMinutes, title: 'Minutos lidos por período' })}</div>
          <div class="chart-tip" id="tip-time" aria-live="polite"></div>
          ${dataTable(series, period === 'semana' ? 'Semana' : 'Mês')}
        </section>

        <section class="section card">
          <div class="section-head"><h2>Páginas por mês</h2></div>
          <div id="chart-pages">${barChart(pages, { kind: 'count', axisFormat: (v) => formatInt(v), title: 'Páginas lidas por mês' })}</div>
          <div class="chart-tip" id="tip-pages" aria-live="polite"></div>
          ${dataTable(pages, 'Mês')}
        </section>

        ${whereSection(t)}

        <section class="section card">
          <div class="section-head"><h2>Concluídos</h2></div>
          ${doneTable(t)}
        </section>`,
    );

    bindChart($('#chart-time', main), series, $('#tip-time', main));
    bindChart($('#chart-pages', main), pages, $('#tip-pages', main));
    onAction(main, {
      period: (el) => {
        period = el.dataset.value;
        this.render(main);
      },
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
