// Completed, not-yet-acknowledged voyages survive reloads and tab closure.
// Each run is its own record: concurrent tabs never overwrite one shared list.
const defaultIndexedDB=()=>{try{return globalThis.indexedDB;}catch{return null;}};
export class ReplayOutbox {
  constructor(indexedDB = defaultIndexedDB()) { this.indexedDB = indexedDB; this.db = null; }
  async open() {
    if (!this.indexedDB) throw new Error('Browser replay storage is unavailable.');
    if (this.db) return this.db;
    this.db = new Promise((resolve, reject) => {
      const request = this.indexedDB.open('strait-ranked-outbox', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('voyages', {keyPath:'id'});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Replay storage is blocked.'));
    });
    try { return await this.db; } catch (error) { this.db = null; throw error; }
  }
  async transaction(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('voyages', mode), request = action(tx.objectStore('voyages'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Replay storage interrupted.'));
    });
  }
  list() { return this.transaction('readonly', store => store.getAll()); }
  put(item) { return this.transaction('readwrite', store => store.put({...item, id:item.challenge.id})); }
  delete(id) { return this.transaction('readwrite', store => store.delete(id)); }
}
