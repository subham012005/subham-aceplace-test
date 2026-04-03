import * as admin from "firebase-admin";

/**
 * Server-side Firebase Admin SDK initializer.
 * Only initializes if a service account key is provided.
 */
function initializeAdmin() {
    if (admin.apps.length > 0) return true;

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        console.error("[ADMIN] Missing credentials:", { hasEmail: !!clientEmail, hasKey: !!privateKey });
        return false;
    }

    if (privateKey.includes("Your-Private-Key-Here")) {
        console.error("[ADMIN] Placeholder key detected.");
        return false;
    }

    if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
        console.error("[ADMIN] Invalid key format. Starts with:", privateKey.substring(0, 20));
        return false;
    }

    try {
        // Robust cleanup: Replace literal \n with actual newlines if they exist
        // Also handle cases where the key might be wrapped in unexpected quotes
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
        console.log("[ADMIN] Firebase Admin SDK initialized successfully.");
        return true;
    } catch (error) {
        console.error("[ADMIN] Failed to initialize Firebase Admin SDK:", error);
        return false;
    }
}

const isBackendReady = initializeAdmin();

if (!isBackendReady) {
    console.error("[ADMIN] Firebase Admin SDK NOT initialized.");
} else {
    console.log("[ADMIN] Firebase Admin SDK is ready.");
}

// Export proxies that return a special state if not initialized
const adminDb = isBackendReady ? admin.firestore() : null;

// Apply settings only once (prevents errors during HMR)
if (adminDb && !(global as any)._firestoreSettingsApplied) {
    adminDb.settings({ ignoreUndefinedProperties: true });
    (global as any)._firestoreSettingsApplied = true;
}

const adminAuth = isBackendReady ? admin.auth() : null;

export { adminDb, adminAuth, admin, isBackendReady };
