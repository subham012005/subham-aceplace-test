/**
 * Deterministic In-Memory Firestore Driver
 */
declare class MockDocRef {
    col: string;
    id: string;
    private db;
    constructor(col: string, id: string, db: any);
    get(): Promise<any>;
    set(data: any, opts?: any): any;
    update(data: any): any;
    delete(): any;
    collection(subCol: string): any;
}
declare class MockQuery {
    private col;
    private db;
    private filters;
    private _limit;
    private _order;
    constructor(col: string, db: any);
    where(field: string, op: string, value: any): this;
    orderBy(field: string, dir?: string): this;
    limit(n: number): this;
    get(): Promise<{
        empty: boolean;
        size: any;
        docs: any;
    }>;
}
export declare class MemoryDb {
    private store;
    collection(col: string): {
        doc: (id: string) => MockDocRef;
        add: (data: any) => Promise<MockDocRef>;
        where: (f: string, o: string, v: any) => MockQuery;
        orderBy: (f: string, d: string) => MockQuery;
        limit: (n: number) => MockQuery;
        get: () => Promise<{
            empty: boolean;
            size: any;
            docs: any;
        }>;
    };
    runTransaction(fn: (tx: any) => Promise<any>): Promise<any>;
    _read(col: string, id: string): {
        exists: boolean;
        id: string;
        data: () => any;
    };
    _write(col: string, id: string, data: any, merge: boolean): void;
    _patch(col: string, id: string, data: any): void;
    _delete(col: string, id: string): void;
    _query(col: string, filters: any[]): any[];
    reset(): void;
}
export declare const memoryDb: any;
export {};
//# sourceMappingURL=memory-db.d.ts.map