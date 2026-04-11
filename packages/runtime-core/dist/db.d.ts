/**
 * Runtime DB Helper — Provides a non-null Firestore reference.
 * Initializes Firebase Admin SDK independently if uninitialized,
 * keeping runtime-core separated from Next.js.
 */
import * as admin from "firebase-admin";
/**
 * Get a guaranteed non-null Firestore reference.
 * Initializes the app if called for the first time.
 */
export declare function getDb(): admin.firestore.Firestore;
/**
 * For testing purposes ONLY: override the database instance.
 */
export declare function setDb(db: any): void;
//# sourceMappingURL=db.d.ts.map