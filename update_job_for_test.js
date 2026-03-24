
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const serviceAccount = {
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const jobId = 'job_1774108274727_2nawfy6';
  const newUserId = 'cje30qyaxwRtqLJVV5OOS0BJs2G3';
  
  await db.collection('jobs').doc(jobId).update({
    user_id: newUserId,
    status: 'REJECTED', // Test uppercase
    rejection_reason: 'Manual test rejection'
  });
  
  console.log(`Updated job ${jobId} with user_id ${newUserId} and status REJECTED`);
}

run().catch(console.error);
