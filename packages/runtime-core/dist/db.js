"use strict";
/**
 * Runtime DB Helper — Provides a non-null Firestore reference.
 * Initializes Firebase Admin SDK independently if uninitialized,
 * keeping runtime-core separated from Next.js.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.setDb = setDb;
const admin = __importStar(require("firebase-admin"));
function initializeRuntimeDb() {
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
let dbInstance = null;
/**
 * Get a guaranteed non-null Firestore reference.
 * Initializes the app if called for the first time.
 */
function getDb() {
    if (dbInstance)
        return dbInstance;
    // 🔬 TEST OVERRIDE: Use the deterministic in-memory DB if available in global.
    const globalDb = global.__ACEPLACE_MEMORY_DB__;
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
        }
        catch (e) { }
    }
    dbInstance = initializeRuntimeDb();
    return dbInstance;
}
/**
 * For testing purposes ONLY: override the database instance.
 */
function setDb(db) {
    dbInstance = db;
}
//# sourceMappingURL=db.js.map