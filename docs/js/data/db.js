// Camada fina sobre o IndexedDB.
// Stores: items (livros/artigos), entries (registros de leitura), kv (configurações e metadados).

const DB_NAME = 'leituras-db';
const DB_VERSION = 1;

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
  });
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('status', 'status');
        items.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('entries')) {
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('itemId', 'itemId');
        entries.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Banco bloqueado por outra aba aberta. Feche-a e tente de novo.'));
  });
  return dbPromise;
}

export async function getAll(store) {
  const db = await openDb();
  return promisify(db.transaction(store).objectStore(store).getAll());
}

export async function getKv(key) {
  const db = await openDb();
  const row = await promisify(db.transaction('kv').objectStore('kv').get(key));
  return row ? row.value : undefined;
}

/**
 * Escreve várias operações numa única transação (tudo ou nada).
 * ops: [{ store, put: obj } | { store, delete: id } | { store: 'kv', key, value }]
 */
export async function write(ops) {
  const db = await openDb();
  const stores = [...new Set(ops.map((op) => op.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const op of ops) {
    const os = tx.objectStore(op.store);
    if (op.store === 'kv') os.put({ key: op.key, value: op.value });
    else if (op.delete !== undefined) os.delete(op.delete);
    else os.put(op.put);
  }
  return txDone(tx);
}

/** Substitui todo o conteúdo (restaurar backup / importar). */
export async function replaceAll({ items, entries, kv }) {
  const db = await openDb();
  const tx = db.transaction(['items', 'entries', 'kv'], 'readwrite');
  const itemsStore = tx.objectStore('items');
  const entriesStore = tx.objectStore('entries');
  const kvStore = tx.objectStore('kv');
  itemsStore.clear();
  entriesStore.clear();
  for (const item of items) itemsStore.put(item);
  for (const entry of entries) entriesStore.put(entry);
  for (const [key, value] of Object.entries(kv)) kvStore.put({ key, value });
  return txDone(tx);
}
