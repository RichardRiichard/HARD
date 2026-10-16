// Fluxos de restauração (Drive e arquivo) — sempre com confirmação explícita.
import { html } from './dom.js';
import { confirmDialog, toast, openSheet } from './overlay.js';
import { icon } from './icons.js';
import { state } from '../data/store.js';
import * as store from '../data/store.js';
import { backup, fetchVersion, applyRestore, listVersions } from '../services/backup.js';
import { parseBackup } from '../core/transfer.js';
import { formatDateTime } from '../core/dates.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function replaceMessage(data, origin) {
  const pendingNote = backup.enabled && backup.pending ? '\n\nAs alterações deste aparelho que ainda não foram para o backup serão perdidas.' : '';
  return (
    `${origin}: ${plural(data.items.length, 'item', 'itens')} e ${plural(data.entries.length, 'registro', 'registros')}.\n\n` +
    `Isso substitui TODOS os dados deste aparelho (${plural(state.items.length, 'item', 'itens')} e ${plural(state.entries.length, 'registro', 'registros')}).` +
    pendingNote
  );
}

/** Restaura uma versão do Drive. Chamar direto de um toque (pode pedir login). */
export async function restoreFromDrive(file) {
  try {
    const r = await fetchVersion(file.id);
    if (!r.ok) {
      toast(r.error, { kind: 'error' });
      return false;
    }
    const ok = await confirmDialog({
      title: 'Restaurar backup',
      message: replaceMessage(r.data, `Backup de ${formatDateTime(file.createdTime)}`),
      confirmLabel: 'Restaurar',
      danger: true,
    });
    if (!ok) return false;
    await applyRestore(r.data);
    toast('Backup restaurado');
    return true;
  } catch (err) {
    toast(err.message, { kind: 'error' });
    return false;
  }
}

/** Lista as versões do Drive para escolher qual restaurar. */
export async function openVersionPicker() {
  let files;
  try {
    files = await listVersions();
  } catch (err) {
    toast(err.message, { kind: 'error' });
    return;
  }
  const sheet = openSheet({
    title: 'Restaurar do Drive',
    content: files.length
      ? html`<p class="hint" style="margin-top:0">Escolha a versão. Você confirma antes de qualquer dado ser substituído.</p>
          <div class="backup-versions">
            ${files.map(
              (f, i) => html`<button type="button" class="row" data-file="${i}">
                <span class="type-dot livro">${icon('cloud')}</span>
                <div class="row-main">
                  <div class="row-title">${formatDateTime(f.createdTime)}</div>
                  <div class="row-sub">${i === 0 ? 'Mais recente · ' : ''}${Math.max(1, Math.round(f.size / 1024))} KB</div>
                </div>
              </button>`,
            )}
          </div>`
      : html`<div class="empty"><p>Nenhum backup encontrado no Drive.</p></div>`,
  });
  sheet.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-file]');
    if (!btn) return;
    sheet.close();
    await restoreFromDrive(files[Number(btn.dataset.file)]);
  });
}

/** Importa um arquivo JSON exportado. */
export async function importFromText(text) {
  const r = parseBackup(text);
  if (!r.ok) {
    toast(r.error, { kind: 'error' });
    return false;
  }
  const origin = r.data.exportedAt ? `Arquivo exportado em ${formatDateTime(r.data.exportedAt)}` : 'Arquivo';
  const ok = await confirmDialog({
    title: 'Importar dados',
    message: replaceMessage(r.data, origin),
    confirmLabel: 'Importar',
    danger: true,
  });
  if (!ok) return false;
  await store.replaceAll(r.data, { source: 'import' });
  toast('Dados importados');
  return true;
}
