require('dotenv').config({ path: './.env' });
const GITHUB_PAT = process.env.GITHUB_PAT;
fetch(`https://api.github.com/repos/d0ul0s/Residential-Proxy-Method/contents/.github/workflows/schedule-1784458422647.yml`, {
    headers: { 'Authorization': `token ${GITHUB_PAT}` }
}).then(res => res.json()).then(data => {
    if (data.content) {
        console.log(Buffer.from(data.content, 'base64').toString('utf8'));
    } else {
        console.log("No content", data);
    }
});
