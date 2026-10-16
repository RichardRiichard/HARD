// Gráfico de colunas em SVG, sem bibliotecas. Uma série, eixo único, toque/hover mostra o valor.
import { html, raw, esc } from './dom.js';

const W = 340;
const H = 168;
const PAD = { top: 18, right: 4, bottom: 22, left: 40 };

/** Passo "redondo" para o eixo Y, com no máximo ~4 divisões. */
export function niceStep(max, steps) {
  for (const s of steps) if (max / s <= 4) return s;
  const last = steps[steps.length - 1];
  return Math.ceil(max / 4 / last) * last;
}

const MINUTE_STEPS = [5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3000, 6000];
const COUNT_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

function columnPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * data: [{ label, value, tip }]
 * kind: 'minutes' | 'count' (define os passos do eixo); axisFormat(v): texto do eixo.
 * O valor da coluna selecionada aparece fora do gráfico (bindChart), sem colisão de rótulos.
 */
export function barChart(data, { kind = 'minutes', axisFormat, title }) {
  const n = data.length;
  const max = Math.max(0, ...data.map((d) => d.value));
  const step = niceStep(max || 1, kind === 'minutes' ? MINUTE_STEPS : COUNT_STEPS);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / n;
  const barW = Math.min(24, band * 0.62);
  const y = (v) => PAD.top + plotH - (v / top) * plotH;

  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const labelEvery = band < 30 ? 2 : 1;

  let svg = '';
  for (const v of ticks) {
    const ty = y(v).toFixed(1);
    svg += `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${ty}" y2="${ty}"/>`;
    svg += `<text x="${PAD.left - 6}" y="${ty}" text-anchor="end" dominant-baseline="middle">${esc(axisFormat(v))}</text>`;
  }
  data.forEach((d, i) => {
    const cx = PAD.left + band * i + band / 2;
    const x = cx - barW / 2;
    const h = (d.value / top) * plotH;
    svg += `<path class="bar" data-i="${i}" d="${columnPath(x, PAD.top + plotH - h, barW, h)}"/>`;
    if ((n - 1 - i) % labelEvery === 0) {
      svg += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    }
    svg += `<rect class="bar-hit" data-i="${i}" x="${PAD.left + band * i}" y="0" width="${band}" height="${H}" tabindex="0" role="button" aria-label="${esc(d.tip)}"/>`;
  });

  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">${raw(svg)}</svg>`;
}

/** Liga toque/hover/teclado: mostra o tip da coluna e destaca a barra. */
export function bindChart(container, data, tipEl, defaultIndex = data.length - 1) {
  const bars = [...container.querySelectorAll('.bar')];
  const show = (i) => {
    bars.forEach((b) => b.classList.toggle('current', Number(b.dataset.i) === i));
    tipEl.textContent = data[i]?.tip || '';
  };
  container.addEventListener('pointerover', (e) => {
    const hit = e.target.closest('.bar-hit');
    if (hit) show(Number(hit.dataset.i));
  });
  container.addEventListener('click', (e) => {
    const hit = e.target.closest('.bar-hit');
    if (hit) show(Number(hit.dataset.i));
  });
  container.addEventListener('focusin', (e) => {
    const hit = e.target.closest('.bar-hit');
    if (hit) show(Number(hit.dataset.i));
  });
  show(defaultIndex);
}
