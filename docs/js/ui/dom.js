// Utilidades de DOM: templates com escape automático e delegação de eventos.

class Safe {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

/** Marca texto como HTML confiável (não escapa). Use só com conteúdo gerado pelo app. */
export const raw = (s) => new Safe(String(s));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

function val(v) {
  if (v == null || v === false) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(val).join('');
  return esc(v);
}

/** Template tag: html`<p>${texto}</p>` escapa interpolações (exceto raw/html aninhado). */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += val(values[i]) + strings[i + 1];
  return new Safe(out);
}

export function setHtml(el, content) {
  el.innerHTML = val(content);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegação: elementos com data-action="nome" chamam handlers.nome(el, evento). */
export function onAction(root, handlers) {
  root.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !root.contains(target)) return;
    const fn = handlers[target.dataset.action];
    if (!fn) return;
    e.preventDefault();
    fn(target, e);
  };
}

/** Lê os campos nomeados de um formulário como objeto de strings. */
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else if (el.type === 'checkbox') {
      out[el.name] = el.checked;
    } else {
      out[el.name] = el.value;
    }
  }
  return out;
}

/** Matiz estável a partir de um texto (para capas sem imagem). */
export function hueOf(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

export function initials(text) {
  const words = String(text || '?').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}
