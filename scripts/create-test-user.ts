/**
 * scripts/create-test-user.ts
 * 
 * Creates a standard test user in Firebase Auth for the USER to log in and verify the branding.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function createTestUser() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }

    const auth = getAuth();
    const email = "admin@aceplace.ai";
    const password = "aceplace2024";

    try {
        const user = await auth.createUser({
            email,
            password,
            displayName: "ACEPLACE Admin",
        });
        console.log(`✅ Successfully created test user: ${user.email}`);
    } catch (err: any) {
        if (err.code === 'auth/email-already-exists') {
            console.log(`ℹ️ User ${email} already exists. Ready for login.`);
        } else {
            console.error("❌ Failed to create user:", err);
        }
    }
}

createTestUser().catch(console.error);
