// Google Drive (pasta oculta appDataFolder) via Google Identity Services, sem backend.
// Escopo mínimo: drive.appdata — o app só enxerga os próprios arquivos ocultos.
import { GOOGLE_CLIENT_ID } from '../config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME = 'backup.json';
const TOKEN_KEY = 'leituras.drive.token';

export class AuthError extends Error {}

export function isConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.trim());
}

// ---------- Script de login (GIS) ----------

let gisPromise = null;
export function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      s.remove();
      reject(new Error('Não foi possível carregar o login do Google. Verifique a internet.'));
    };
    document.head.append(s);
  });
  return gisPromise;
}

// ---------- Token (dura ~1 h; guardado só neste aparelho) ----------

function safeStorage(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getToken() {
  const saved = safeStorage(() => JSON.parse(localStorage.getItem(TOKEN_KEY)));
  if (!saved?.access_token || !saved.expiresAt) return null;
  return Date.now() < saved.expiresAt - 60_000 ? saved.access_token : null;
}

function saveToken(resp) {
  const expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
  safeStorage(() => localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: resp.access_token, expiresAt })));
}

export function clearToken() {
  safeStorage(() => localStorage.removeItem(TOKEN_KEY));
}

const ERRORS = {
  popup_closed: 'Login cancelado.',
  popup_failed_to_open: 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site.',
};

/**
 * Pede um token. Precisa ser chamado direto de um toque/clique do usuário
 * (o login abre uma janela). firstTime=true mostra a tela de consentimento.
 */
export function requestToken({ firstTime = false, hint = '' } = {}) {
  const run = () =>
    new Promise((resolve, reject) => {
      const oauth2 = globalThis.google.accounts.oauth2;
      const client = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID.trim(),
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error === 'access_denied' ? 'Acesso negado.' : `Erro no login: ${resp.error}`));
            return;
          }
          if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(resp, SCOPE)) {
            reject(new Error('A permissão de acesso à pasta do app no Drive não foi concedida.'));
            return;
          }
          saveToken(resp);
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(ERRORS[err?.type] || 'Falha no login do Google.')),
      });
      const options = { prompt: firstTime ? 'consent' : '' };
      if (hint) {
        options.login_hint = hint;
        options.hint = hint;
      }
      client.requestAccessToken(options);
    });
  // Se o script já carregou, abre a janela no mesmo toque (evita bloqueio de pop-up).
  if (globalThis.google?.accounts?.oauth2) return run();
  return loadGis().then(run);
}

export function revokeToken() {
  const token = safeStorage(() => JSON.parse(localStorage.getItem(TOKEN_KEY)))?.access_token;
  clearToken();
  if (token && globalThis.google?.accounts?.oauth2?.revoke) {
    globalThis.google.accounts.oauth2.revoke(token, () => {});
  }
}

// ---------- API REST do Drive ----------

async function api(url, token, { method = 'GET', headers = {}, body, as = 'json' } = {}) {
  if (navigator.onLine === false) throw new Error('Sem conexão com a internet.');
  let res;
  try {
    res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  } catch {
    throw new Error('Não foi possível conectar ao Google Drive.');
  }
  if (res.status === 401) {
    clearToken();
    throw new AuthError('A sessão do Google expirou. Conecte de novo.');
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {
      /* sem corpo */
    }
    throw new Error(`O Google Drive respondeu com erro ${res.status}${detail ? `: ${detail}` : ''}.`);
  }
  if (as === 'none' || res.status === 204) return null;
  return as === 'text' ? res.text() : res.json();
}

/** E-mail da conta conectada (opcional: falha não impede o backup). */
export async function getAccountEmail(token) {
  try {
    const data = await api(`${API}/about?fields=user(emailAddress,displayName)`, token);
    return data?.user?.emailAddress || data?.user?.displayName || '';
  } catch (err) {
    if (err instanceof AuthError) throw err;
    return '';
  }
}

/** Versões de backup, da mais nova para a mais antiga. */
export async function listBackups(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    orderBy: 'createdTime desc',
    fields: 'files(id,createdTime,size,appProperties)',
    pageSize: '50',
  });
  const data = await api(`${API}/files?${params}`, token);
  return (data.files || []).map((f) => ({
    id: f.id,
    createdTime: f.createdTime,
    size: Number(f.size) || 0,
    dataUpdatedAt: f.appProperties?.dataUpdatedAt || f.createdTime,
  }));
}

export async function uploadBackup(token, json, dataUpdatedAt) {
  const boundary = `leituras-${Math.random().toString(36).slice(2)}`;
  const metadata = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
    appProperties: { dataUpdatedAt },
  };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n--${boundary}--`;
  return api(`${UPLOAD}/files?uploadType=multipart&fields=id,createdTime`, token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

export function downloadBackup(token, id) {
  return api(`${API}/files/${encodeURIComponent(id)}?alt=media`, token, { as: 'text' });
}

export function deleteFile(token, id) {
  return api(`${API}/files/${encodeURIComponent(id)}`, token, { method: 'DELETE', as: 'none' });
}
