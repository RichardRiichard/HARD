// Estado em memória + persistência. Toda alteração passa por aqui,
// grava no IndexedDB e avisa a interface (evento 'change').

import * as db from './db.js';
import { normalizeSettings } from '../core/calc.js';

export const state = {
  items: [],
  entries: [],
  settings: normalizeSettings(),
  /** Instante (ISO) da última alteração de dados neste aparelho. */
  dataUpdatedAt: null,
};

const listeners = new Set();

/** Inscreve uma função chamada após cada alteração. detail.source: 'user' | 'restore' */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(detail) {
  for (const fn of listeners) {
    try {
      fn(detail);
    } catch (err) {
      console.error(err);
    }
  }
}

export async function init() {
  const [items, entries, settings, dataUpdatedAt] = await Promise.all([
    db.getAll('items'),
    db.getAll('entries'),
    db.getKv('settings'),
    db.getKv('dataUpdatedAt'),
  ]);
  state.items = items;
  state.entries = entries;
  state.settings = normalizeSettings(settings);
  state.dataUpdatedAt = dataUpdatedAt || null;
}

/** Aplica um lote de mudanças: { items?: [...], entries?: [...], deleteItems?: [ids], deleteEntries?: [ids] } */
export async function commit({ items = [], entries = [], deleteItems = [], deleteEntries = [], settings } = {}) {
  const now = new Date().toISOString();
  const ops = [
    ...items.map((put) => ({ store: 'items', put })),
    ...entries.map((put) => ({ store: 'entries', put })),
    ...deleteItems.map((id) => ({ store: 'items', delete: id })),
    ...deleteEntries.map((id) => ({ store: 'entries', delete: id })),
    { store: 'kv', key: 'dataUpdatedAt', value: now },
  ];
  if (settings) ops.push({ store: 'kv', key: 'settings', value: settings });
  await db.write(ops);

  state.items = upsert(state.items.filter((i) => !deleteItems.includes(i.id)), items);
  state.entries = upsert(state.entries.filter((e) => !deleteEntries.includes(e.id)), entries);
  if (settings) state.settings = settings;
  state.dataUpdatedAt = now;
  emit({ source: 'user' });
}

function upsert(list, changed) {
  if (!changed.length) return list;
  const byId = new Map(list.map((x) => [x.id, x]));
  for (const x of changed) byId.set(x.id, x);
  return [...byId.values()];
}

export function saveSettings(patch) {
  return commit({ settings: normalizeSettings({ ...state.settings, ...patch }) });
}

/** Substitui tudo (restaurar/importar). Mantém o dataUpdatedAt do backup. */
export async function replaceAll({ items, entries, settings, dataUpdatedAt }) {
  const normalized = normalizeSettings(settings);
  const stamp = dataUpdatedAt || new Date().toISOString();
  await db.replaceAll({ items, entries, kv: { settings: normalized, dataUpdatedAt: stamp } });
  state.items = items;
  state.entries = entries;
  state.settings = normalized;
  state.dataUpdatedAt = stamp;
  emit({ source: 'restore' });
}

// ---------- Consultas ----------

export function getItem(id) {
  return state.items.find((i) => i.id === id) || null;
}

export function entriesOf(itemId) {
  return state.entries.filter((e) => e.itemId === itemId);
}

export function itemsById() {
  return new Map(state.items.map((i) => [i.id, i]));
}

/** Entradas da mais recente para a mais antiga (data, depois horário de criação). */
export function sortedEntries(entries = state.entries) {
  return [...entries].sort((a, b) => (a.date === b.date ? (b.createdAt > a.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
}
