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

async function fixSubcollections() {
    const jobId = 'job_1774108274727_2nawfy6';
    const userId = 'cje30qyaxwRtqLJVV5OOS0BJs2G3';
    
    console.log(`Fixing permissions for job: ${jobId} and user: ${userId}`);
    
    const collections = ['job_traces', 'artifacts', 'fork_events', 'deliverables'];
    
    for (const colName of collections) {
        const snapshot = await db.collection(colName).where('job_id', '==', jobId).get();
        console.log(`Found ${snapshot.size} documents in ${colName}`);
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { user_id: userId });
        });
        
        if (snapshot.size > 0) {
            await batch.commit();
            console.log(`Updated ${snapshot.size} documents in ${colName}`);
        }
    }
    
    console.log('Permission fix completed successfully.');
}

fixSubcollections().catch(err => {
    console.error('Error fixing permissions:', err);
    process.exit(1);
});
