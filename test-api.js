const https = require('https');

const data = JSON.stringify({
  displayName: 'TestUser',
  email: 'test' + Date.now() + '@example.com',
  password: 'Password123'
});

const options = {
  hostname: 'dfcci-threshold-3sbv.onrender.com',
  port: 443,
  path: '/api/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Origin': 'https://dfcci-threshold.vercel.app'
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => { console.log('Body:', responseData); });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(data);
req.end();
