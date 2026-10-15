// Tela inicial: tempo total, semana, sequência e livros em andamento.
import { html, setHtml } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../../data/store.js';
import { formatDuration, splitHours } from '../../core/calc.js';
import { minutesThisWeek, streak, totalMinutes } from '../../core/stats.js';
import { today } from '../../core/dates.js';

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

export default {
  title: 'Leituras',
  tab: 'inicio',
  render(main) {
    setHtml(main, html`${hero()}`);
  },
};
