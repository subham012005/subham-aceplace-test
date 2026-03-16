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
 * Increments the total n8n request count for a specific user.
 * Creates the document if it doesn't exist.
 */
export async function incrementUserRequestCount(userId: string) {
    if (!userId) return;

    const statsRef = doc(db, "users", userId, "stats", "dash");

    try {
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
            await updateDoc(statsRef, {
                total_n8n_requests: increment(1),
                last_request_at: new Date().toISOString()
            });
        } else {
            await setDoc(statsRef, {
                total_n8n_requests: 1,
                last_request_at: new Date().toISOString()
            }, { merge: true });
        }
    } catch (error) {
        console.error("[STATS] Error incrementing user request count:", error);
    }
}

/**
 * Subscribes to the user's stats document to get real-time updates of request counts.
 */
export function subscribeToUserStats(userId: string, callback: (stats: any) => void) {
    const statsRef = doc(db, "users", userId, "stats", "dash");

    return onSnapshot(statsRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback({ total_n8n_requests: 0 });
        }
    }, (error) => {
        console.error("Error subscribing to user stats:", error);
    });
}
