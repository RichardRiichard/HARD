// Aviso no topo: versão mais nova no Drive ou login expirado.
import { html, setHtml } from './dom.js';
import { icon } from './icons.js';
import { toast } from './overlay.js';
import { backup, shouldNudgeLogin, connect, declineCloud, dismissBanner } from '../services/backup.js';
import { restoreFromDrive } from './restore.js';
import { formatDateTime } from '../core/dates.js';

export function renderBanner(el) {
  if (backup.cloudNewer) {
    const f = backup.cloudNewer;
    setHtml(
      el,
      html`<div class="banner" role="alert">
        ${icon('cloud')}
        <p>Há um backup mais recente no Drive (${formatDateTime(f.createdTime)}). Restaurar neste aparelho?</p>
        <button type="button" class="btn btn-sm" data-banner="decline">Agora não</button>
        <button type="button" class="btn btn-sm btn-primary" data-banner="restore">Ver</button>
      </div>`,
    );
  } else if (shouldNudgeLogin()) {
    setHtml(
      el,
      html`<div class="banner">
        ${icon('cloud')}
        <p>${backup.pending ? 'Há alterações sem backup.' : 'Backup no Drive:'} Toque para sincronizar.</p>
        <button type="button" class="btn btn-sm btn-primary" data-banner="connect">Sincronizar</button>
        <button type="button" class="icon-btn" data-banner="dismiss" aria-label="Dispensar aviso">${icon('close')}</button>
      </div>`,
    );
  } else {
    setHtml(el, '');
  }
}

export function bindBanner(el) {
  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-banner]');
    if (!btn) return;
    const action = btn.dataset.banner;
    if (action === 'decline') {
      declineCloud();
      toast('Ok. O próximo backup deste aparelho vira a versão mais recente; as anteriores ficam guardadas.', { duration: 5000 });
    } else if (action === 'restore') {
      await restoreFromDrive(backup.cloudNewer);
    } else if (action === 'dismiss') {
      dismissBanner();
    } else if (action === 'connect') {
      try {
        await connect();
        if (!backup.cloudNewer) toast(backup.error ? backup.error : 'Drive sincronizado', { kind: backup.error ? 'error' : 'info' });
      } catch (err) {
        toast(err.message, { kind: 'error' });
      }
    }
  });
}
