require('dotenv').config({ path: './.env' });
require('mongoose').connect(process.env.MONGODB_URI).then(async () => {
    const Schedule = require('./models/Schedule');
    const Member = require('./models/Member');
    
    const schedule = await Schedule.findOne({ scheduleName: 'Trial 1' });
    const allMembers = await Member.find();
    
    const sortedQueue = [...schedule.messageQueue].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    
    let cutoffDateObj = new Date();
    // Simulate Sunday past noon
    cutoffDateObj.setDate(cutoffDateObj.getDate() + 1);
    const cutoffDateStr = cutoffDateObj.toISOString().split('T')[0];

    const limit = 3;
    const upcomingItems = sortedQueue.filter(q => !q.isSent && q.targetDate >= cutoffDateStr).slice(0, limit);
    
    let reminderTasks = [];
    let finalMessage = "Test message";
    let actionType = 'MAIN';

    for (const queuedItem of upcomingItems) {
        if (actionType === 'MAIN' && schedule.targetRole && queuedItem.parsedRoles) {
            const assignedName = queuedItem.parsedRoles.get(schedule.targetRole);
            if (assignedName) {
                const member = allMembers.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                if (member && member.facebookChatUrl) {
                    reminderTasks.push({
                        url: member.facebookChatUrl,
                        message: finalMessage
                    });
                } else {
                    console.log("MEMBER NOT FOUND OR NO URL:", assignedName);
                }
            }
        }
    }
    
    console.log("REMINDER TASKS:", JSON.stringify(reminderTasks, null, 2));
    process.exit(0);
});
