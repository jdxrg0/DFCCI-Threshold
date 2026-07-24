require('dotenv').config({ path: './.env' });
require('mongoose').connect('mongodb://dfcciUser:ex4BOmxkysQwp5kn@ac-my0qqce-shard-00-00.4plgq96.mongodb.net:27017,ac-my0qqce-shard-00-01.4plgq96.mongodb.net:27017,ac-my0qqce-shard-00-02.4plgq96.mongodb.net:27017/dfcci_threshold?ssl=true&authSource=admin&retryWrites=true&w=majority&appName=dfcciUser').then(async () => {
    const Schedule = require('./models/Schedule');
    const schedule = await Schedule.findOne({ scheduleName: 'Trial 1' });
    
    if (!schedule) {
        console.log("Schedule 'Trial 1' not found");
        process.exit(1);
    }
    
    console.log("Found schedule. githubFileName:", schedule.githubFileName);
    
    const owner = 'd0ul0s';
    const repo = 'Residential-Proxy-Method';
    const GITHUB_PAT = process.env.GITHUB_PAT;
    
    console.log("Using PAT starting with:", GITHUB_PAT ? GITHUB_PAT.substring(0, 8) + '...' : 'UNDEFINED');
    
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${schedule.githubFileName}/dispatches`;
    console.log("POSTing to:", url);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_PAT}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    dynamic_message: 'Test run',
                    code_message: '',
                    reminder_tasks: '[]'
                }
            })
        });
        
        console.log("Response Status:", response.status, response.statusText);
        
        if (!response.ok) {
            const errorData = await response.text();
            console.log("Error Body:", errorData);
        } else {
            console.log("Successfully dispatched workflow!");
        }
    } catch (e) {
        console.error("Fetch failed entirely:", e);
    }
    
    process.exit(0);
});
