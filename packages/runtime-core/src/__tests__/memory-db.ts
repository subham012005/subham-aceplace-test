/**
 * Deterministic In-Memory Firestore Driver
 */

class MockDocRef {
  public col: string;
  public id: string;
  private db: any;
  constructor(col: string, id: string, db: any) {
    this.col = col;
    this.id = id;
    this.db = db;
  }
  async get() { return this.db._read(this.col, this.id); }
  set(data: any, opts?: any) { return this.db._write(this.col, this.id, data, opts?.merge); }
  update(data: any) { return this.db._patch(this.col, this.id, data); }
  delete() { return this.db._delete(this.col, this.id); }
  collection(subCol: string) { return this.db.collection(`${this.col}/${this.id}/${subCol}`); }
}


class MockQuery {
  private filters: any[] = [];
  private _limit: number = 0;
  private _order: any[] = [];
  private col: string;
  private db: any;

  constructor(col: string, db: any) {
    this.col = col;
    this.db = db;
  }


  where(field: string, op: string, value: any) {
    this.filters.push({ field, op, value });
    return this;
  }

  orderBy(field: string, dir: string = "asc") {
    this._order.push({ field, dir });
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  async get() {
    let docs = this.db._query(this.col, this.filters);
    if (this._order.length > 0) {
      docs.sort((a: any, b: any) => {
        const field = this._order[0].field;
        const dir = this._order[0].dir === "asc" ? 1 : -1;
        if (a[field] < b[field]) return -1 * dir;
        if (a[field] > b[field]) return 1 * dir;
        return 0;
      });
    }
    if (this._limit > 0) docs = docs.slice(0, this._limit);
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map((d: any) => ({
        id: d._id,
        ref: new MockDocRef(this.col, d._id, this.db),
        data: () => d
      }))
    };
  }
}

export class MemoryDb {
  private store: Map<string, any> = new Map();

  collection(col: string) {
    return {
      doc: (id: string) => new MockDocRef(col, id, this),
      add: async (data: any) => {
        const id = `auto_${Math.random().toString(36).slice(2, 12)}`;
        const ref = new MockDocRef(col, id, this);
        await ref.set(data, {});
        return ref;
      },
      where: (f: string, o: string, v: any) => new MockQuery(col, this).where(f, o, v),
      orderBy: (f: string, d: string) => new MockQuery(col, this).orderBy(f, d),
      limit: (n: number) => new MockQuery(col, this).limit(n),
      get: async () => new MockQuery(col, this).get()
    };
  }

  async runTransaction(fn: (tx: any) => Promise<any>) {
    const tx = {
      get: async (ref: MockDocRef) => ref.get(),
      update: (ref: MockDocRef, data: any) => ref.update(data),
      set: (ref: MockDocRef, data: any, opts: any) => ref.set(data, opts),
      delete: (ref: MockDocRef) => ref.delete()
    };
    return fn(tx);
  }

  _read(col: string, id: string) {
    const data = this.store.get(`${col}/${id}`);
    const res = {
      exists: !!data,
      id,
      data: () => data ? { ...data } : undefined
    };
    return res;
  }

  _write(col: string, id: string, data: any, merge: boolean) {
    const key = `${col}/${id}`;
    const existing = merge ? (this.store.get(key) || {}) : {};
    const final = { ...existing, ...data, _id: id };
    this.store.set(key, final);
  }

  _patch(col: string, id: string, data: any) {
    const key = `${col}/${id}`;
    const existing = this.store.get(key) || {};
    const final = { ...existing, ...data, _id: id };
    this.store.set(key, final);
  }

  _delete(col: string, id: string) {
    this.store.delete(`${col}/${id}`);
  }

  _query(col: string, filters: any[]) {
    let results: any[] = [];
    this.store.forEach((val, key) => {
      if (key.startsWith(`${col}/`)) {
        let match = true;
        for (const f of filters) {
          if (f.op === "==") match = val[f.field] === f.value;
          else if (f.op === "in") match = Array.isArray(f.value) && f.value.includes(val[f.field]);
          else if (f.op === ">=") match = val[f.field] >= f.value;
          if (!match) break;
        }
        if (match) results.push({ ...val });
      }
    });
    return results;
  }

  reset() { this.store.clear(); }
}

export const memoryDb = (global as any).__ACEPLACE_MEMORY_DB__ || new MemoryDb();
(global as any).__ACEPLACE_MEMORY_DB__ = memoryDb;
