
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function checkJobs() {
  console.log('--- Checking Latest Jobs ---');
  const jobsSnap = await db.collection('jobs').orderBy('updated_at', 'desc').limit(5).get();
  
  if (jobsSnap.empty) {
    console.log('No jobs found.');
    return;
  }

  jobsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Job ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Prompt: ${data.prompt}`);
    console.log(`Grade Score: ${data.grade_score || 'N/A'}`);
    console.log(`Final Result Summary: ${data.final_result?.final_summary || 'N/A'}`);
    console.log('---');
  });
}

checkJobs().catch(console.error);
