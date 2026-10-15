// Backup automático no Google Drive.
// - Após cada alteração, espera 30 s sem novas mudanças e envia (se houver login válido e internet).
// - Mantém as 5 versões mais recentes.
// - Ao abrir (com login válido), avisa se a nuvem tem dados mais novos. Nunca restaura sem confirmação.
import * as store from '../data/store.js';
import * as drive from './drive.js';
import { buildExport, parseBackup } from '../core/transfer.js';

const KEEP_VERSIONS = 5;
const DELAY_MS = 30_000;
const STALE_CHECK_MS = 12 * 60 * 60 * 1000;
const STATE_KEY = 'leituras.backup';
const PERSISTED = ['enabled', 'email', 'lastBackupAt', 'pending', 'lastCheckAt', 'declinedId'];

/** Estado do backup neste aparelho (não vai para o backup). */
export const backup = {
  enabled: false,
  email: '',
  lastBackupAt: null,
  pending: false,
  lastCheckAt: null,
  declinedId: null,
  busy: false,
  error: '',
  /** Versão na nuvem mais nova que os dados locais, aguardando decisão: { id, createdTime, dataUpdatedAt } */
  cloudNewer: null,
  bannerDismissed: false,
};

let timer = null;
const listeners = new Set();

export function onBackupChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(backup);
    } catch (err) {
      console.error(err);
    }
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    for (const k of PERSISTED) if (k in saved) backup[k] = saved[k];
  } catch {
    /* armazenamento indisponível */
  }
}

function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(Object.fromEntries(PERSISTED.map((k) => [k, backup[k]]))));
  } catch {
    /* armazenamento indisponível */
  }
}

export const isConfigured = drive.isConfigured;
export const hasToken = () => Boolean(drive.getToken());

/** Conectado antes, mas o login expirou: precisa de um toque para renovar. */
export function needsLogin() {
  return backup.enabled && !drive.getToken();
}

/** Mostrar o aviso "conecte para sincronizar"? Só se houver motivo (alterações pendentes ou verificação antiga). */
export function shouldNudgeLogin() {
  if (!needsLogin() || backup.bannerDismissed) return false;
  const stale = !backup.lastCheckAt || Date.now() - new Date(backup.lastCheckAt).getTime() > STALE_CHECK_MS;
  return backup.pending || stale;
}

export function init() {
  load();
  if (!drive.isConfigured()) return;
  store.onChange(onDataChange);
  window.addEventListener('online', () => {
    if (!backup.enabled || !drive.getToken()) return;
    if (backup.pending) flush();
  });
  // Ao sair do app com alterações na fila, tenta enviar já.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      timer = null;
      flush();
    }
  });
  if (backup.enabled) {
    if (navigator.onLine) drive.loadGis().catch(() => {});
    if (drive.getToken()) startupSync();
  }
  emit();
}

async function startupSync() {
  await checkCloud();
  if (backup.pending && !backup.cloudNewer) flush();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, DELAY_MS);
}

function onDataChange({ source }) {
  if (!backup.enabled || source === 'restore') return;
  backup.pending = true;
  persist();
  emit();
  schedule();
}

/** Envia o backup agora. manual=true ignora a espera por decisão sobre versão mais nova na nuvem. */
export async function flush({ manual = false } = {}) {
  if (!backup.enabled || backup.busy) return;
  if (backup.cloudNewer && !manual) return;
  const token = drive.getToken();
  if (!token) {
    emit();
    return;
  }
  if (navigator.onLine === false) {
    backup.error = 'Sem internet. O backup será enviado quando a conexão voltar.';
    emit();
    return;
  }
  backup.busy = true;
  backup.error = '';
  emit();
  const stamp = store.state.dataUpdatedAt;
  try {
    const data = buildExport(store.state);
    await drive.uploadBackup(token, JSON.stringify(data), data.dataUpdatedAt);
    await prune(token);
    backup.lastBackupAt = new Date().toISOString();
    backup.lastCheckAt = backup.lastBackupAt;
    backup.cloudNewer = null;
    // Se algo mudou durante o envio, continua pendente.
    backup.pending = store.state.dataUpdatedAt !== stamp;
  } catch (err) {
    backup.error = err.message;
  } finally {
    backup.busy = false;
    persist();
    emit();
  }
  if (backup.pending && !timer && !backup.error) schedule();
}

async function prune(token) {
  const files = await drive.listBackups(token);
  for (const f of files.slice(KEEP_VERSIONS)) {
    try {
      await drive.deleteFile(token, f.id);
    } catch {
      /* tenta de novo no próximo backup */
    }
  }
}

/** Compara a versão mais nova da nuvem com os dados locais. */
export async function checkCloud() {
  const token = drive.getToken();
  if (!token || navigator.onLine === false) return;
  try {
    const files = await drive.listBackups(token);
    backup.lastCheckAt = new Date().toISOString();
    const latest = files[0];
    const local = store.state.dataUpdatedAt || '';
    backup.cloudNewer = latest && latest.dataUpdatedAt > local && latest.id !== backup.declinedId ? latest : null;
    backup.error = '';
  } catch (err) {
    backup.error = err.message;
  }
  persist();
  emit();
}

/** Token válido ou login (chamar direto de um toque do usuário). */
export function ensureToken() {
  const token = drive.getToken();
  return token ? Promise.resolve(token) : drive.requestToken({ hint: backup.email });
}

/** Conectar (ou reconectar) ao Drive. Chamar direto de um toque do usuário. */
export async function connect() {
  const firstTime = !backup.enabled;
  const token = await drive.requestToken({ firstTime, hint: backup.email });
  backup.email = (await drive.getAccountEmail(token)) || backup.email;
  backup.enabled = true;
  backup.error = '';
  backup.bannerDismissed = false;
  persist();
  emit();
  await checkCloud();
  if (!backup.cloudNewer && (firstTime || backup.pending)) {
    backup.pending = true;
    await flush({ manual: true });
  }
}

/** "Backup agora": conecta se preciso e envia. */
export async function backupNow() {
  await ensureToken();
  backup.pending = true;
  await flush({ manual: true });
  if (backup.error) throw new Error(backup.error);
}

export function disconnect() {
  drive.revokeToken();
  clearTimeout(timer);
  timer = null;
  Object.assign(backup, {
    enabled: false,
    email: '',
    lastBackupAt: null,
    pending: false,
    lastCheckAt: null,
    declinedId: null,
    error: '',
    cloudNewer: null,
  });
  persist();
  emit();
}

export async function listVersions() {
  const token = await ensureToken();
  return drive.listBackups(token);
}

/** Baixa e valida uma versão. Retorna { ok, data } ou { ok: false, error }. */
export async function fetchVersion(id) {
  const token = await ensureToken();
  const text = await drive.downloadBackup(token, id);
  return parseBackup(text);
}

/** Aplica um backup já baixado e validado (após confirmação do usuário). */
export async function applyRestore(data) {
  await store.replaceAll(data, { source: 'restore' });
  clearTimeout(timer);
  timer = null;
  backup.pending = false;
  backup.cloudNewer = null;
  backup.declinedId = null;
  persist();
  emit();
}

/** "Agora não" para a versão mais nova da nuvem: não pergunta de novo por ela. */
export function declineCloud() {
  backup.declinedId = backup.cloudNewer?.id || null;
  backup.cloudNewer = null;
  persist();
  emit();
  if (backup.pending) schedule();
}

export function dismissBanner() {
  backup.bannerDismissed = true;
  emit();
}
