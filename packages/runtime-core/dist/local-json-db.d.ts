declare class MockDocRef {
    col: string;
    id: string;
    private db;
    constructor(col: string, id: string, db: any);
    get(): Promise<any>;
    set(data: any, opts?: any): Promise<any>;
    update(data: any): Promise<any>;
    delete(): Promise<any>;
    collection(subCol: string): any;
}
declare class MockQuery {
    private filters;
    private _limit;
    private _order;
    private col;
    private db;
    constructor(col: string, db: any);
    where(field: string, op: string, value: any): this;
    orderBy(field: string, dir?: string): this;
    limit(n: number): this;
    get(): Promise<{
        empty: boolean;
        size: any;
        docs: any;
    }>;
    onSnapshot(onNext: (snap: any) => void, onError?: (err: any) => void): () => void;
}
export declare class LocalJsonDb {
    private filepath;
    constructor(filepath?: string);
    private _load;
    private _save;
    private _processValue;
    private _processObject;
    collection(col: string): {
        doc: (id?: string) => MockDocRef;
        add: (data: any) => Promise<MockDocRef>;
        where: (f: string, o: string, v: any) => MockQuery;
        orderBy: (f: string, d: string) => MockQuery;
        limit: (n: number) => MockQuery;
        get: () => Promise<{
            empty: boolean;
            size: any;
            docs: any;
        }>;
        onSnapshot: (onNext: any, onError?: any) => () => void;
    };
    runTransaction(fn: (tx: any) => Promise<any>): Promise<any>;
    batch(): {
        set: (ref: MockDocRef, data: any, opts?: any) => void;
        update: (ref: MockDocRef, data: any) => void;
        delete: (ref: MockDocRef) => void;
        commit: () => Promise<void>;
    };
    _read(col: string, id: string): {
        exists: boolean;
        id: string;
        data: () => any;
    };
    _write(col: string, id: string, data: any, merge: boolean): void;
    _patch(col: string, id: string, data: any): void;
    _delete(col: string, id: string): void;
    _query(col: string, filters: any[]): any[];
}
export declare const FieldValue: {
    serverTimestamp: () => {
        type: string;
    };
    increment: (n: number) => {
        type: string;
        args: number;
    };
    arrayUnion: (...args: any[]) => {
        type: string;
        args: any[];
    };
};
export {};
//# sourceMappingURL=local-json-db.d.ts.map