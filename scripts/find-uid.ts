/**
 * scripts/find-uid.ts
 * 
 * finds the UID for a given email to use in test scripts.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function findUid() {
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

    try {
        const user = await auth.getUserByEmail(email);
        console.log(`UID_RESULT:${user.uid}`);
    } catch (err: any) {
        console.error("❌ Failed to find user:", err);
    }
}

findUid().catch(console.error);
