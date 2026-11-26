import * as THREE from 'three';

export type AssetCacheSource = 'ram' | 'indexeddb' | 'network';

interface StoredAssetRecord {
  url: string;
  kind: 'text' | 'buffer';
  payload: string | ArrayBuffer;
  updatedAt: number;
}

const DB_NAME = 'engine3d_model_cache_v1';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

export class ModelCacheManager {
  private readonly rawMemoryCache = new Map<string, string | ArrayBuffer>();
  private readonly objectMemoryCache = new Map<string, THREE.Object3D>();
  private readonly sourceMap = new Map<string, AssetCacheSource>();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        resolve(null);
        return;
      }
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  private async readFromIndexedDB(url: string): Promise<StoredAssetRecord | null> {
    const db = await this.openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(url);
        req.onsuccess = () => resolve((req.result as StoredAssetRecord | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async writeToIndexedDB(record: StoredAssetRecord): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async fetchText(url: string): Promise<{ text: string; source: AssetCacheSource }> {
    const mem = this.rawMemoryCache.get(url);
    if (typeof mem === 'string') {
      this.sourceMap.set(url, 'ram');
      return { text: mem, source: 'ram' };
    }

    const idbRecord = await this.readFromIndexedDB(url);
    if (idbRecord && typeof idbRecord.payload === 'string') {
      this.rawMemoryCache.set(url, idbRecord.payload);
      this.sourceMap.set(url, 'indexeddb');
      return { text: idbRecord.payload, source: 'indexeddb' };
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al descargar ${url}`);
    }
    const text = await res.text();
    this.rawMemoryCache.set(url, text);
    this.sourceMap.set(url, 'network');
    await this.writeToIndexedDB({
      url,
      kind: 'text',
      payload: text,
      updatedAt: Date.now(),
    });
    return { text, source: 'network' };
  }

  public async fetchArrayBuffer(
    url: string
  ): Promise<{ buffer: ArrayBuffer; source: AssetCacheSource }> {
    const mem = this.rawMemoryCache.get(url);
    if (mem instanceof ArrayBuffer) {
      this.sourceMap.set(url, 'ram');
      return { buffer: mem.slice(0), source: 'ram' };
    }

    const idbRecord = await this.readFromIndexedDB(url);
    if (idbRecord && idbRecord.payload instanceof ArrayBuffer) {
      this.rawMemoryCache.set(url, idbRecord.payload);
      this.sourceMap.set(url, 'indexeddb');
      return { buffer: idbRecord.payload.slice(0), source: 'indexeddb' };
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al descargar ${url}`);
    }
    const buffer = await res.arrayBuffer();
    this.rawMemoryCache.set(url, buffer);
    this.sourceMap.set(url, 'network');
    await this.writeToIndexedDB({
      url,
      kind: 'buffer',
      payload: buffer.slice(0),
      updatedAt: Date.now(),
    });
    return { buffer: buffer.slice(0), source: 'network' };
  }

  public getClonedObject(url: string): THREE.Object3D | null {
    const proto = this.objectMemoryCache.get(url);
    if (!proto) return null;
    this.sourceMap.set(url, 'ram');
    return proto.clone(true);
  }

  public storeObjectPrototype(url: string, object: THREE.Object3D): void {
    this.objectMemoryCache.set(url, object);
  }

  public getSourceLabel(url: string): string {
    const src = this.sourceMap.get(url);
    if (src === 'indexeddb') return 'Caché IndexedDB';
    if (src === 'ram') return 'Caché RAM';
    if (src === 'network') return 'Descargado de red';
    return 'Pendiente';
  }

  public async clearAll(): Promise<void> {
    this.rawMemoryCache.clear();
    this.objectMemoryCache.clear();
    this.sourceMap.clear();
    THREE.Cache.clear();

    const db = await this.openDatabase();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export const modelCacheManager = new ModelCacheManager();
