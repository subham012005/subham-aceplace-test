
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
  const snapshot = await db.collection('jobs').limit(5).get();
  snapshot.forEach(doc => {
    console.log(`Job ID: ${doc.id}, User ID: ${doc.data().user_id}`);
  });
}

run().catch(console.error);
