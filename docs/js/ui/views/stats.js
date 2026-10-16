// Estatísticas: total, ritmo, por tipo, por semana/mês, páginas, previsão de término, onde foi o tempo e concluídos.
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
  finishForecast,
  topItems,
  topSources,
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

function forecastSection(t) {
  const books = state.items.filter((i) => i.type === 'livro' && i.status === 'lendo');
  if (!books.length) return '';
  const rows = books
    .map((b) => ({ b, f: finishForecast(b, state.entries, t) }))
    .filter((r) => r.f)
    .sort((x, y) => (x.f.daysLeft ?? 1e9) - (y.f.daysLeft ?? 1e9));
  if (!rows.length) return '';
  return html`<section class="section card">
    <div class="section-head"><h2>Previsão de término</h2><span class="small muted">ritmo dos últimos 30 dias</span></div>
    <div class="list">
      ${rows.map(
        ({ b, f }) => html`<a class="kv" href="#/item/${encodeURIComponent(b.id)}" style="text-decoration:none;color:inherit">
          <span>${b.title}<br><span class="small">faltam ${f.remaining} pág.${f.pagesPerDay ? ` · ${formatDecimal(f.pagesPerDay, 1)} pág./dia` : ''}</span></span>
          <span>${f.daysLeft ? html`~${f.daysLeft} ${f.daysLeft === 1 ? 'dia' : 'dias'}<br><span class="small muted">${formatDateShort(f.date)}</span>` : html`<span class="small muted">sem leitura recente</span>`}</span>
        </a>`,
      )}
    </div>
  </section>`;
}

function rankList(rows) {
  if (!rows.length) return html`<p class="small muted" style="margin:0">Nada ainda.</p>`;
  const max = rows[0].minutes || 1;
  return html`<div class="type-bars">
    ${rows.map(
      (r) => html`<div>
        <div class="type-bar-label"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.label}</span><b>${formatDuration(r.minutes)}</b></div>
        <div class="type-bar" style="--c:var(--accent)"><i style="width:${(100 * r.minutes) / max}%"></i></div>
      </div>`,
    )}
  </div>`;
}

function whereSection() {
  const byId = store.itemsById();
  return html`<section class="section card">
    <div class="section-head"><h2>Onde foi seu tempo</h2></div>
    <h3 class="small muted" style="margin:0 0 8px">Leituras</h3>
    ${rankList(topItems(state.entries, byId, 5))}
    <h3 class="small muted" style="margin:16px 0 8px">Autores e sites</h3>
    ${rankList(topSources(state.entries, byId, 5))}
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

        ${forecastSection(t)}
        ${whereSection()}

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
    });
  },
};
