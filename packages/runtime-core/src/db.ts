/**
 * Runtime DB Helper — Provides a non-null Firestore reference.
 * Throws if Firebase Admin is not initialized.
 */

import type { firestore } from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Get a guaranteed non-null Firestore reference.
 * Throws an error if Firebase Admin SDK is not initialized.
 */
export function getDb(): firestore.Firestore {
  if (!adminDb) {
    throw new Error("[RUNTIME] Firebase Admin SDK not initialized. Check credentials.");
  }
  return adminDb as firestore.Firestore;
}
