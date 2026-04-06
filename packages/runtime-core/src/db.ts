/**
 * Runtime DB Helper — Provides a non-null Firestore reference.
 * Initializes Firebase Admin SDK independently if uninitialized, 
 * keeping runtime-core separated from Next.js.
 */

import * as admin from "firebase-admin";

function initializeRuntimeDb(): admin.firestore.Firestore {
    if (admin.apps.length > 0) {
        return admin.firestore();
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
        });
        const db = admin.firestore();
        db.settings({ ignoreUndefinedProperties: true });
        return db;
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        throw new Error("[RUNTIME-CORE] Missing credentials for Firestore (check FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON).");
    }

    let cleanedKey = privateKey.trim();
    if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
        cleanedKey = cleanedKey.substring(1, cleanedKey.length - 1);
    }
    const formattedPrivateKey = cleanedKey.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: formattedPrivateKey,
        }),
        projectId,
    });
    
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    return db;
}

// ── Database Instance ────────────────────────────────────────────────────────
let dbInstance: admin.firestore.Firestore | any = null;

/**
 * Get a guaranteed non-null Firestore reference.
 * Initializes the app if called for the first time.
 */
export function getDb(): admin.firestore.Firestore {
    if (dbInstance) return dbInstance;

    // 🔬 TEST OVERRIDE: Use the deterministic in-memory DB if available in global.
    const globalDb = (global as any).__ACEPLACE_MEMORY_DB__;
    if (globalDb) {
       dbInstance = globalDb;
       return dbInstance;
    }

    if (process.env.VITEST) {
      try {
        const { memoryDb } = require("./__tests__/memory-db");
        if (memoryDb) {
           dbInstance = memoryDb;
           return dbInstance;
        }
      } catch (e: any) { }
    }

    dbInstance = initializeRuntimeDb();
    return dbInstance;
}

/**
 * For testing purposes ONLY: override the database instance.
 */
export function setDb(db: any) {
    dbInstance = db;
}
