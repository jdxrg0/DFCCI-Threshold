const https = require('https');
https.get('https://dfcci-threshold.vercel.app', (res) => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => {
    const match = d.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if(match) {
      console.log('JS URL:', match[1]);
      https.get('https://dfcci-threshold.vercel.app' + match[1], (res2) => {
        let d2 = '';
        res2.on('data', c => d2+=c);
        res2.on('end', () => {
          console.log('Includes render URL?', d2.includes('onrender.com'));
          console.log('Includes localhost?', d2.includes('localhost:5000'));
        });
      });
    } else {
      console.log('No JS file found');
    }
  });
});
