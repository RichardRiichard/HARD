// Estatísticas: total, por tipo, por semana/mês, páginas, concluídos e sequência.
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
  streak,
  completedSummary,
  minutesByDay,
} from '../../core/stats.js';
import { today, addDays, weekStart, formatWeekShort, formatMonthShort, formatMonthLong, formatDateShort } from '../../core/dates.js';
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

/** Calendário das últimas 16 semanas (intensidade = minutos do dia). */
function heatmap(t) {
  const days = minutesByDay(state.entries);
  const start = addDays(weekStart(t), -7 * 15);
  const cells = [];
  for (let i = 0; i < 16 * 7; i++) {
    const d = addDays(start, i);
    const m = days.get(d) || 0;
    const level = d > t ? 'future' : m === 0 ? '' : m < 15 ? 'l1' : m < 45 ? 'l2' : 'l3';
    cells.push(html`<i class="${level}" title="${formatDateShort(d)}: ${formatDuration(m)}"></i>`);
  }
  return html`<div class="heatmap" role="img" aria-label="Dias com leitura nas últimas 16 semanas">${cells}</div>
    <div class="small muted" style="display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:6px">
      Menos <span class="heatmap" style="display:inline-grid;grid-template-rows:1fr;width:64px"><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i></span> Mais
    </div>`;
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
    const s = streak(state.entries, t);
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
          ${stat(formatInt(totalPages(state.entries)), 'páginas lidas')}
          ${stat(s.current === 1 ? '1 dia' : `${s.current} dias`, 'sequência atual')}
          ${stat(s.longest === 1 ? '1 dia' : `${s.longest} dias`, 'maior sequência')}
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

        <section class="section card">
          <div class="section-head"><h2>Concluídos</h2></div>
          ${doneTable(t)}
        </section>

        <section class="section card">
          <div class="section-head"><h2>Dias com leitura</h2><span class="small muted">16 semanas</span></div>
          ${heatmap(t)}
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
