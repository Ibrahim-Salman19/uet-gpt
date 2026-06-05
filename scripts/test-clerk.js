const https = require('https');

const secretKey = 'sk_test_6fcMcCHe5MC98CepjE2sheJkzDW1RvZY4K1qFCY5cz';

const options = {
  hostname: 'api.clerk.com',
  port: 443,
  path: '/v1/users?limit=1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/json'
  }
};

console.log('Testing Clerk Secret Key...');
const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
