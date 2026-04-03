const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Runner script to load .env.local and run seed-identities.ts
 */
async function run() {
    const envFile = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([^#=]+)\s*=\s*["']?(.*?)["']?\s*$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                process.env[key] = value;
            }
        });
    }

    process.env.ACELOGIC_IDENTITY_SALT = 'nxq_salt_2024';

    console.log('--- Environment Loaded ---');
    console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    console.log('Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
    console.log('--------------------------\n');

    try {
        execSync('npx -y tsx scripts/seed-identities.ts', { 
            stdio: 'inherit',
            env: process.env 
        });
    } catch (err) {
        console.error('Execution failed:', err.message);
    }
}

run();
