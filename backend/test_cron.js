const cron = require('node-cron');
console.log("Current time:", new Date().toISOString());

const d = new Date();
d.setMinutes(d.getMinutes() + 1);

const cronStr = `${d.getUTCMinutes()} ${d.getUTCHours()} * * *`;
console.log("Scheduling cron for:", cronStr, "(in 1 minute)");

cron.schedule(cronStr, () => {
    console.log("Cron fired at:", new Date().toISOString());
    process.exit(0);
}, { scheduled: true, timezone: "UTC" });

setTimeout(() => {
    console.log("Timeout reached, cron did not fire after 65 seconds");
    process.exit(1);
}, 65000);
