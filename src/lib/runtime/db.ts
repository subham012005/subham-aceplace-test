/**
 * Runtime DB Helper — Provides a non-null Firestore reference.
 * Throws if Firebase Admin is not initialized.
 */

import { adminDb } from "@/lib/firebase-admin";

/**
 * Get a guaranteed non-null Firestore reference.
 * Throws an error if Firebase Admin SDK is not initialized.
 */
export function getDb() {
  if (!adminDb) {
    throw new Error("[RUNTIME] Firebase Admin SDK not initialized. Check credentials.");
  }
  return adminDb;
}
