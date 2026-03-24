/**
 * e2e-test-runtime.ts — Full dispatch-to-completion verification script.
 * T-035 | Sprint 6
 *
 * Usage: npx tsx scripts/e2e-test-runtime.ts
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import "dotenv/config";

// ── Configuration ────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const TEST_USER_ID = "test_user_e2e_001";
const TEST_PROMPT = "Explain the importance of deterministic runtimes in multi-agent systems.";
const MAX_POLL_ATTEMPTS = 60; // 5 minutes with 5s interval
const POLL_INTERVAL_MS = 5000;

// ── Firebase Init ────────────────────────────────────────────────────────────

function initFirebase() {
    if (!getApps().length) {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!clientEmail || !privateKey) {
            console.error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
            process.exit(1);
        }

        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }
    return getFirestore();
}

// ── Main Flow ────────────────────────────────────────────────────────────────

async function runE2E() {
    console.log("🚀 Starting Phase 2 E2E Test...");
    console.log(`📡 API Base: ${API_BASE_URL}`);

    const db = initFirebase();

    // 1. Dispatch Task
    console.log("\n1️⃣ Dispatching task...");
    const dispatchResponse = await fetch(`${API_BASE_URL}/api/runtime/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: TEST_PROMPT,
            user_id: TEST_USER_ID,
            agent_id: "agent_coo"
        })
    });

    if (!dispatchResponse.ok) {
        const errorText = await dispatchResponse.text();
        throw new Error(`Dispatch failed (${dispatchResponse.status}): ${errorText}`);
    }

    const { execution_id, job_id } = await dispatchResponse.json();
    console.log(`✅ Dispatched! Execution ID: ${execution_id} | Job ID: ${job_id}`);

    // 2. Poll for Completion
    console.log("\n2️⃣ Polling for completion (this may take a few minutes)...");
    let attempt = 0;
    let status = "created";
    let envelopeData: any = null;

    while (attempt < MAX_POLL_ATTEMPTS) {
        attempt++;
        const doc = await db.collection("envelopes").doc(execution_id).get();

        if (doc.exists) {
            envelopeData = doc.data();
            status = envelopeData?.execution_context?.status || "unknown";

            process.stdout.write(`\r[Attempt ${attempt}/${MAX_POLL_ATTEMPTS}] Status: ${status} ... `);

            if (status === "completed") {
                console.log("\n✅ Execution completed successfully!");
                break;
            }

            if (status === "failed") {
                console.log("\n❌ Execution failed!");
                console.error("Error Detail:", envelopeData?.execution_context?.error);
                process.exit(1);
            }
        } else {
            process.stdout.write(`\r[Attempt ${attempt}/${MAX_POLL_ATTEMPTS}] Envelope not found yet... `);
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (status !== "completed") {
        console.log("\n❌ Test timed out.");
        process.exit(1);
    }

    // 3. Verify Steps & Artifacts
    console.log("\n3️⃣ Verifying steps and artifacts...");

    const stepsSnapshot = await db.collection("execution_steps")
        .where("execution_id", "==", execution_id)
        .orderBy("started_at", "asc")
        .get();

    console.log(`📊 Total steps found: ${stepsSnapshot.size}`);
    stepsSnapshot.forEach(stepDoc => {
        const step = stepDoc.data();
        console.log(`   - [${step.status.toUpperCase()}] ${step.step_type} (${step.agent_id})`);
    });

    const artifactsSnapshot = await db.collection("artifacts")
        .where("execution_id", "==", execution_id)
        .get();

    console.log(`📦 Artifacts produced: ${artifactsSnapshot.size}`);

    const messagesSnapshot = await db.collection("protocol_messages")
        .where("execution_id", "==", execution_id)
        .get();

    console.log(`💬 Protocol messages (#us#): ${messagesSnapshot.size}`);

    if (artifactsSnapshot.size === 0) {
        console.warn("⚠️ Warning: No artifacts were produced.");
    }

    console.log("\n✨ E2E TEST PASSED! ✨");
}

runE2E().catch(err => {
    console.error("\n💥 E2E TEST FAILED:", err);
    process.exit(1);
});
