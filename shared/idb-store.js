/*
 * Tiny promise-based wrapper around a single IndexedDB object store.
 * Generic across calculators — each one opens its own database name so
 * saved runs never collide between tools.
 *
 * Note: IndexedDB persistence is scoped to the page's origin. That works
 * cleanly when the page is served over https (e.g. GitHub Pages) — saved
 * runs persist across visits. Opened directly via file://, most browsers
 * still persist it per exact file path, but treatment of file:// storage
 * varies across browsers and can be cleared more aggressively — prefer the
 * hosted URL if you want saved runs to reliably survive.
 *
 * API:
 *   const store = new SharedIDB.Store(dbName, storeName);
 *   await store.put(record)         // record.id auto-assigned if absent
 *   await store.getAll()
 *   await store.delete(id)
 *   await store.clear()
 */
(function (global) {
  "use strict";

  class Store {
    constructor(dbName, storeName) {
      this.dbName = dbName;
      this.storeName = storeName;
      this._dbPromise = null;
    }

    _open() {
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._dbPromise;
    }

    async _tx(mode) {
      const db = await this._open();
      const tx = db.transaction(this.storeName, mode);
      return { tx, store: tx.objectStore(this.storeName) };
    }

    async put(record) {
      const { tx, store } = await this._tx("readwrite");
      return new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
    }

    async getAll() {
      const { store } = await this._tx("readonly");
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async delete(id) {
      const { tx, store } = await this._tx("readwrite");
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
    }

    async clear() {
      const { tx, store } = await this._tx("readwrite");
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  global.SharedIDB = { Store };
})(typeof window !== "undefined" ? window : globalThis);
