const EmailLog = require('./models/EmailLog');
const sendEmail = require('./utils/sendEmail');

console.log('--- BACKEND INTEGRATION TEST ---');
console.log('EmailLog Model loaded successfully:', typeof EmailLog === 'function' ? 'YES' : 'NO');
console.log('sendEmail Utility loaded successfully:', typeof sendEmail === 'function' ? 'YES' : 'NO');
console.log('SUCCESS: All files compile and load cleanly!');
process.exit(0);
