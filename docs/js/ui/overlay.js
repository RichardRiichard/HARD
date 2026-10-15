// Painéis (dialog), confirmação e avisos (toasts).
import { html, setHtml, esc } from './dom.js';
import { icon } from './icons.js';

/**
 * Abre um painel modal. Retorna { el, body, close }.
 * onClose é chamado uma vez quando o painel fecha (por qualquer motivo).
 */
export function openSheet({ title, content, onClose, className = '' }) {
  const dialog = document.createElement('dialog');
  dialog.className = `sheet ${className}`;
  setHtml(
    dialog,
    html`<div class="sheet-inner">
      <header class="sheet-head">
        <h2>${title}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('close')}</button>
      </header>
      <div class="sheet-body"></div>
    </div>`,
  );
  const body = dialog.querySelector('.sheet-body');
  setHtml(body, content);
  document.body.append(dialog);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose?.();
  };
  dialog.addEventListener('close', close);
  dialog.addEventListener('click', (e) => {
    // Clique no fundo escurecido (fora do conteúdo) fecha.
    if (e.target === dialog || e.target.closest('[data-close]')) close();
  });
  dialog.showModal();
  const firstField = body.querySelector('[autofocus]');
  if (firstField) firstField.focus();
  return { el: dialog, body, close };
}

/** Confirmação. Resolve true (confirmou), false (botão cancelar) ou null (fechou o painel). */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let answer = null;
    const sheet = openSheet({
      title,
      className: 'sheet-small',
      content: html`<p class="confirm-msg">${message}</p>
        <div class="actions">
          <button type="button" class="btn" data-answer="no">${cancelLabel}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-answer="yes">${confirmLabel}</button>
        </div>`,
      onClose: () => resolve(answer),
    });
    sheet.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-answer]');
      if (!btn) return;
      answer = btn.dataset.answer === 'yes';
      sheet.close();
    });
  });
}

let toastRoot = null;
function root() {
  if (!toastRoot) {
    toastRoot = document.getElementById('toasts');
  }
  return toastRoot;
}

/**
 * Aviso temporário. kind: 'info' | 'error' | 'gain'
 * action: { label, run } opcional.
 */
export function toast(message, { kind = 'info', duration = 3200, action } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(message)}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.onclick = () => {
      dismiss();
      action.run();
    };
    el.append(btn);
  }
  root().append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  let timer = duration > 0 ? setTimeout(dismiss, duration) : null;
  function dismiss() {
    clearTimeout(timer);
    timer = null;
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }
  return dismiss;
}

/** "+45 min lidos" com animação discreta. */
export function gainToast(minutes) {
  return toast(`+${minutes} min lidos`, { kind: 'gain', duration: 2600 });
}
