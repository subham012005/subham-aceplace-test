import { db } from "./firebase";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    onSnapshot
} from "firebase/firestore";

/**
 * Increments the total request count for a specific user.
 * Creates the document if it doesn't exist.
 */
export async function incrementUserRequestCount(userId: string) {
    if (!userId) return;

    const statsRef = doc(db, "users", userId, "stats", "dash");

    try {
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
            await updateDoc(statsRef, {
                total_requests: increment(1),
                last_request_at: new Date().toISOString()
            });
        } else {
            await setDoc(statsRef, {
                total_requests: 1,
                last_request_at: new Date().toISOString()
            }, { merge: true });
        }
    } catch (error) {
        console.error("[STATS] Error incrementing user request count:", error);
    }
}

/**
 * Subscribes to the user's stats document — DISABLED (Security Migration)
 * Use useRuntimeStats hook instead for secure dashboard metrics.
 */
export function subscribeToUserStats(userId: string, callback: (stats: any) => void) {
    // Return early with defaults to avoid permission errors
    callback({ total_requests: 0 });
    return () => {}; // return empty unsubscribe
}
