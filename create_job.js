const http = require('http');

const data = JSON.stringify({
  user_id: 'cNFEfL1QcJZIFCm8kihnEeNlk1J3',
  prompt: 'Research on Nvidia new ai era',
  requested_agent_id: 'agent_coo',
  job_type: 'agent_coo'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/jobs/intake',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${body}`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});

req.write(data);
req.end();
