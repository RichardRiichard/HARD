// Inicialização e rotas (#/rota/parametro).
import * as store from './data/store.js';
import { icon } from './ui/icons.js';
import { setHtml, html, $, $$ } from './ui/dom.js';
import { toast } from './ui/overlay.js';
import home from './ui/views/home.js';
import library from './ui/views/library.js';
import item from './ui/views/item.js';
import historico from './ui/views/history.js';
import estatisticas from './ui/views/stats.js';
import config from './ui/views/settings.js';
import * as backupService from './services/backup.js';
import { renderBanner, bindBanner } from './ui/banner.js';

const routes = {
  inicio: home,
  biblioteca: library,
  item,
  historico,
  estatisticas,
  config,
};

const main = document.getElementById('view');
let current = { name: null, param: null };

function parseHash() {
  const [, name = 'inicio', param = null] = location.hash.split('/');
  return { name: routes[name] ? name : 'inicio', param: param ? decodeURIComponent(param) : null };
}

function render({ keepScroll = false } = {}) {
  const route = parseHash();
  const changed = route.name !== current.name || route.param !== current.param;
  current = route;
  const view = routes[route.name];
  const y = window.scrollY;
  try {
    view.render(main, route.param);
  } catch (err) {
    console.error(err);
    setHtml(main, html`<div class="empty"><p>Algo deu errado ao abrir esta tela.</p><p class="small">${err.message}</p></div>`);
  }
  const title = typeof view.title === 'function' ? view.title(route.param) : view.title;
  $('#page-title').textContent = title || 'Leituras';
  document.title = title && title !== 'Leituras' ? `${title} · Leituras` : 'Leituras';
  const tab = view.tab || route.name;
  for (const a of $$('.tabbar a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const back = view.back?.(route.param);
  const backBtn = $('#back-btn');
  backBtn.hidden = !back;
  if (back) backBtn.href = back;
  $('#settings-btn').hidden = route.name === 'config';
  if (changed && !keepScroll) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}

function decorateShell() {
  for (const span of $$('[data-icon]')) setHtml(span, icon(span.dataset.icon));
  setHtml($('#back-btn'), icon('back'));
  setHtml($('#settings-btn'), icon('settings'));
}

// Imagens de capa que falham somem e deixam aparecer as iniciais.
document.addEventListener(
  'error',
  (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.cover')) e.target.remove();
  },
  true,
);

async function start() {
  decorateShell();
  try {
    await store.init();
  } catch (err) {
    console.error(err);
    setHtml(
      main,
      html`<div class="empty"><p>Não foi possível abrir o banco de dados local.</p><p class="small">${err.message}</p></div>`,
    );
    return;
  }
  window.addEventListener('hashchange', () => render());
  store.onChange(() => render({ keepScroll: true }));
  render();

  const banner = document.getElementById('banner');
  bindBanner(banner);
  backupService.onBackupChange(() => {
    renderBanner(banner);
    if (current.name === 'config') render({ keepScroll: true });
  });
  backupService.init();
  renderBanner(banner);

  // Pede ao navegador para não apagar os dados locais quando faltar espaço.
  navigator.storage?.persist?.().catch(() => {});
}

/** Service worker (offline) com aviso quando houver versão nova. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Só recarrega quando o usuário pediu a atualização (na primeira visita o SW assume sem recarregar).
  let updateRequested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested) return;
    updateRequested = false;
    location.reload();
  });
  const offerUpdate = (worker) => {
    toast('Nova versão do app disponível.', {
      duration: 0,
      action: {
        label: 'Atualizar',
        run: () => {
          updateRequested = true;
          worker.postMessage('SKIP_WAITING');
        },
      },
    });
  };
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
    })
    .catch((err) => console.warn('Service worker não registrado:', err));
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast(e.reason?.message || 'Erro inesperado', { kind: 'error' });
});

start();
registerServiceWorker();
