const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function pushFix() {
    const GITHUB_PAT = process.env.GITHUB_PAT;
    const owner = 'd0ul0s';
    const repo = 'Residential-Proxy-Method';
    
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/index.js`, {
        headers: { 'Authorization': `token ${GITHUB_PAT}` }
    });
    const fileData = await getRes.json();
    
    const newContent = fs.readFileSync('index_downloaded.js', 'utf8');
    const base64Content = Buffer.from(newContent).toString('base64');
    
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/index.js`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_PAT}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Fix puppeteer empty url crash',
            content: base64Content,
            sha: fileData.sha,
            branch: 'main'
        })
    });
    
    if (putRes.ok) {
        console.log("Successfully pushed fix to index.js!");
    } else {
        console.log(await putRes.text());
    }
}
pushFix();
