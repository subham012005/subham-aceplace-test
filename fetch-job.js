const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Load .env.local content manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        env[match[1]] = value.replace(/\\n/g, '\n');
    }
});

const serviceAccount = {
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY,
};

const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = getFirestore();

async function getJob(jobId) {
    try {
        const snapshot = await db.collection('jobs').where('job_id', '==', jobId).get();
        if (snapshot.empty) {
            console.log('No matching job found.');
            return;
        }

        const job = snapshot.docs[0].data();
        fs.writeFileSync('job-data.json', JSON.stringify(job, null, 2));
        console.log('Job data saved to job-data.json');
    } catch (error) {
        console.error('Error fetching job:', error);
    }
}

getJob('job_1773172978915');
