const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const AppSetting = require('../models/AppSetting');

class AutomationScheduler {
  constructor() {
    // Map to hold running cron jobs by their MongoDB _id
    this.jobs = new Map();
  }

  async init() {
    try {
      const schedules = await Schedule.find();
      console.log(`[Scheduler] Found ${schedules.length} active schedules. Starting timers...`);
      
      schedules.forEach(schedule => {
        this.addJob(schedule);
      });

      // Global Reader Bot Cron Job (Runs every 2 hours)
      if (!this.readerCron) {
        this.readerCron = cron.schedule('0 */2 * * *', async () => {
          console.log('[Scheduler] Running global Reader Bot check...');
          await this.triggerReaderBot();
        }, { scheduled: true, timezone: "UTC" });
        console.log('[Scheduler] Global Reader Bot cron initialized (every 2 hours).');
      }

      // Weekly Code Generator Cron Job (Runs every Sunday at 12:00 PM PHT)
      if (!this.weeklyCodeCron) {
        this.weeklyCodeCron = cron.schedule('0 12 * * 0', async () => {
          console.log('[Scheduler] Running Weekly Code Generator...');
          await this.generateWeeklyCode();
        }, { scheduled: true, timezone: "Asia/Manila" });
        console.log('[Scheduler] Weekly Code Generator cron initialized (every Sunday 12:00 PM PHT).');
      }

      // Initialize Weekly Code Dispatch Cron Job
      await this.reloadWeeklyCodeDispatch();
    } catch (error) {
      console.error('[Scheduler] Failed to initialize schedules:', error);
    }
  }

  async triggerReaderBot() {
    try {
      const Submission = require('../models/Submission');
      const Member = require('../models/Member');
      
      const pendingSubmissions = await Submission.find({ isComplete: false }).populate('scheduleId');
      if (pendingSubmissions.length === 0) {
        console.log('[Scheduler] No pending submissions found. Skipping Reader Bot.');
        return;
      }

      console.log(`[Scheduler] Found ${pendingSubmissions.length} pending submissions. Preparing to dispatch Reader Bot...`);

      const allMembers = await Member.find();
      const owner = 'd0ul0s';
      const repo = 'Residential-Proxy-Method';

      for (const submission of pendingSubmissions) {
        const schedule = submission.scheduleId;
        if (!schedule) continue;

        // Find the targetQueueItem
        const targetQueueItem = schedule.messageQueue.find(q => q.weeklyConfirmationCode === submission.referenceCode);
        if (!targetQueueItem) continue;

        const chatsToCheck = [];
        
        // Hardcoded roles we care about reading from for now based on user specs
        const requiredRoles = ['Song Leader', 'Opening Song'];
        
        for (const role of requiredRoles) {
          if (targetQueueItem.parsedRoles.get(role)) {
            const assignedName = targetQueueItem.parsedRoles.get(role);
            const member = allMembers.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
            if (member && member.facebookChatUrl) {
              chatsToCheck.push({ url: member.facebookChatUrl, role });
            }
          }
        }

        if (chatsToCheck.length > 0) {
          console.log(`[Scheduler] Dispatching check-replies.yml for ${submission.referenceCode}...`);
          
          await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/check-replies.yml/dispatches`, {
            method: 'POST',
            headers: {
              'Authorization': `token ${process.env.GITHUB_PAT}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: {
                reference_code: submission.referenceCode,
                chats_to_check: JSON.stringify(chatsToCheck)
              }
            })
          });
        }
      }
    } catch (error) {
      console.error('[Scheduler] Failed to trigger reader bot:', error);
    }
  }

  async generateWeeklyCode() {
    try {
      let setting = await AppSetting.findOne({ key: 'weekly_code_config' });
      if (!setting) {
        setting = new AppSetting({ key: 'weekly_code_config', value: { template: 'DFCCI-S-LU-{DATE}' } });
      }
      const value = { ...setting.value };
      
      // Calculate MMDDYY based on next Sunday's date
      const date = new Date();
      const daysUntilNextSunday = date.getDay() === 0 ? 7 : 7 - date.getDay();
      date.setDate(date.getDate() + daysUntilNextSunday);

      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);
      const code = (value.template || 'DFCCI-S-LU-{DATE}').replace(/{DATE}/gi, `${mm}${dd}${yy}`);
      
      value.currentCode = code;
      value.lastGeneratedDate = new Date();
      setting.value = value;
      setting.updatedAt = new Date();
      await setting.save();
      console.log(`[Scheduler] Weekly Code updated to: ${code}`);
    } catch (error) {
      console.error('[Scheduler] Failed to generate weekly code:', error);
    }
  }

  addJob(schedule) {
    const id = schedule._id.toString();
    
    // Clear existing job if it exists (for updates)
    if (this.jobs.has(id)) {
      this.removeJob(id);
    }

    // 1. Main Group Chat Job
    const mainJob = cron.schedule(schedule.cronTime, () => {
      this.triggerGitHubAction(id, 'MAIN');
    }, { scheduled: true, timezone: "UTC" });

    // 2. Daily Reminder Job (Extract time from cronTime and run it every day)
    const timeParts = schedule.cronTime.split(' ');
    const dailyCron = `${timeParts[0]} ${timeParts[1]} * * *`;
    const reminderJob = cron.schedule(dailyCron, () => {
      this.triggerGitHubAction(id, 'REMINDER');
    }, { scheduled: true, timezone: "UTC" });

    // 3. Confirmation Code Job (if enabled)
    let codeJob = null;
    if (schedule.enableCodeBroadcast && schedule.codeCronTime) {
      codeJob = cron.schedule(schedule.codeCronTime, () => {
        this.triggerGitHubAction(id, 'CODE');
      }, { scheduled: true, timezone: "UTC" });
    }

    this.jobs.set(id, { mainJob, reminderJob, codeJob });
    console.log(`[Scheduler] Added jobs for ${id} (Main, Reminder, Code enabled: ${!!codeJob})`);
  }

  removeJob(id) {
    const jobs = this.jobs.get(id);
    if (jobs) {
      if (jobs.mainJob) jobs.mainJob.stop();
      if (jobs.reminderJob) jobs.reminderJob.stop();
      if (jobs.codeJob) jobs.codeJob.stop();
      this.jobs.delete(id);
      console.log(`[Scheduler] Removed jobs for ${id}`);
    }
  }

  async triggerGitHubAction(scheduleId, actionType) {
    try {
      const schedule = await Schedule.findById(scheduleId);
      if (!schedule) return;

      console.log(`[Scheduler] TRIGGERING WORKFLOW [${actionType}]: ${schedule.scheduleName} (${schedule.githubFileName})`);
      
      // Find the closest upcoming unsent message in the queue based on advanceWeeks
      const targetSearchDate = new Date();
      if (schedule.advanceWeeks && schedule.advanceWeeks > 0) {
         targetSearchDate.setDate(targetSearchDate.getDate() + (schedule.advanceWeeks * 7));
      }
      const targetSearchDateStr = targetSearchDate.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0]; // still needed for role reminder diff math
      
      // Sort the queue by date to ensure we get the absolute earliest upcoming date
      const sortedQueue = [...schedule.messageQueue].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
      
      // Pick the first item that is in the future (or target search date) and hasn't been sent
      let queuedItem = sortedQueue.find(q => !q.isSent && q.targetDate >= targetSearchDateStr);

      if (schedule.targetRole && !queuedItem) {
        console.log(`[Scheduler] Specific Role schedule looking for lineup >= ${targetSearchDateStr} but none found. Skipping completely.`);
        return;
      }
      
      let finalMessage = schedule.message;
      let reminderTasks = [];
      let codeMessage = "";
      
      // ---- If this is purely a CODE job ----
      if (actionType === 'CODE') {
        if (queuedItem && queuedItem.weeklyConfirmationCode) {
          codeMessage = `📌 Here's our code for this week's passing of lineups: ${queuedItem.weeklyConfirmationCode}`;
          finalMessage = ""; // Empty main message
        } else {
          console.log(`[Scheduler] No upcoming code found for ${schedule.scheduleName}. Skipping code job.`);
          return;
        }
      } 
      // ---- If this is a MAIN or REMINDER job ----
      else {
        if (queuedItem) {
          finalMessage = queuedItem.messageText;
          console.log(`[Scheduler] Found upcoming schedule for ${queuedItem.targetDate}. Using pre-built Excel message!`);
        } else {
          console.log(`[Scheduler] No upcoming unsent items found in queue! Falling back to raw template.`);
          // Fallback: Just format tomorrow's date so they don't get a raw tag
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateFormatted = tomorrow.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase();
          finalMessage = finalMessage.replace(/{DATE_TOMORROW}/gi, dateFormatted);
          finalMessage = finalMessage.replace(/{DATE_TODAY}/gi, dateFormatted);
        }

        // ----------------------------------------------------
        // EXTRA SAFETY PARSER (Catch-all for any unparsed date tags)
        // ----------------------------------------------------
        const targetDateStr = queuedItem ? queuedItem.targetDate : new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const targetDateObjSafety = new Date(targetDateStr);
        const safetyDateFormatted = targetDateObjSafety.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase();
        
        finalMessage = finalMessage.replace(/{Date Next Sunday}/gi, safetyDateFormatted);
        finalMessage = finalMessage.replace(/{Date}/gi, safetyDateFormatted);
        finalMessage = finalMessage.replace(/{DATE_NEXT_SUNDAY}/gi, safetyDateFormatted);

        // Fetch Weekly Code for replacement
        let weeklyCode = 'NOT_GENERATED';
        try {
          const setting = await AppSetting.findOne({ key: 'weekly_code_config' });
          if (setting && setting.value && setting.value.currentCode) {
            weeklyCode = setting.value.currentCode;
          }
        } catch (e) {
          console.error('[Scheduler] Error fetching weekly code', e);
        }
        finalMessage = finalMessage.replace(/{WeeklyCode}/gi, weeklyCode);

        // ----------------------------------------------------
        // DYNAMIC ROLE TAG REPLACEMENT
        // Replace tags like {Song Leader} with the assigned name
        // ----------------------------------------------------
        if (queuedItem && queuedItem.parsedRoles) {
          for (const [roleName, assignedMember] of queuedItem.parsedRoles.entries()) {
            const roleRegex = new RegExp(`{${roleName}}`, 'gi');
            finalMessage = finalMessage.replace(roleRegex, assignedMember);
          }
        }

        // Find matching role reminders
        const targetDateObj = new Date(queuedItem ? queuedItem.targetDate : todayStr);
        const todayDateObj = new Date(todayStr);
        const diffTime = targetDateObj - todayDateObj;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const Member = require('../models/Member');
        const allMembers = await Member.find();

        if (actionType === 'MAIN' && schedule.targetRole && queuedItem && queuedItem.parsedRoles) {
          if (queuedItem.overrideChatUrl) {
            reminderTasks.push({
               url: queuedItem.overrideChatUrl,
               message: finalMessage,
               expectedCode: queuedItem.weeklyConfirmationCode
            });
            finalMessage = ""; // Prevent sending to a generic chatUrl
          } else {
            const assignedName = queuedItem.parsedRoles.get(schedule.targetRole);
            if (assignedName) {
              const member = allMembers.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
              if (member && member.facebookChatUrl) {
                 reminderTasks.push({
                    url: member.facebookChatUrl,
                    message: finalMessage,
                    expectedCode: queuedItem.weeklyConfirmationCode
                 });
                 finalMessage = ""; // Prevent sending to a generic chatUrl
              } else {
                 console.log(`[Scheduler] Member ${assignedName} for role ${schedule.targetRole} not found or has no chatUrl. Aborting main message.`);
                 return;
              }
            } else {
              console.log(`[Scheduler] No one assigned to role ${schedule.targetRole} for ${queuedItem.targetDate}. Aborting main message.`);
              return;
            }
          }
        }

        if (schedule.roleReminders && schedule.roleReminders.length > 0 && queuedItem && queuedItem.parsedRoles) {
          schedule.roleReminders.forEach(reminder => {
            if (reminder.daysPrior.includes(diffDays)) {
               const assignedName = queuedItem.parsedRoles.get(reminder.role);
               if (assignedName) {
                  const member = allMembers.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                  if (member && member.facebookChatUrl) {
                     let msg = reminder.messageTemplate.replace(/{Name}/gi, assignedName);
                     msg = msg.replace(/{Role}/gi, reminder.role);
                     
                     // Replace any other dynamic role tags in the reminder message
                     for (const [rName, mName] of queuedItem.parsedRoles.entries()) {
                        const roleRegex = new RegExp(`{${rName}}`, 'gi');
                        msg = msg.replace(roleRegex, mName);
                     }
                     msg = msg.replace(/{WeeklyCode}/gi, weeklyCode);
                     reminderTasks.push({
                        url: member.facebookChatUrl,
                        message: msg,
                        expectedCode: queuedItem.weeklyConfirmationCode
                     });
                  }
               }
            }
          });
        }

        // If this is a daily reminder run and there are NO reminders for today, abort early to save resources
        if (actionType === 'REMINDER' && reminderTasks.length === 0) {
          console.log(`[Scheduler] No reminders to send today for ${schedule.scheduleName}. Skipping daily run.`);
          return;
        }

        if (actionType === 'REMINDER') {
          finalMessage = "";
        }
      }

      const owner = 'd0ul0s';
      const repo = 'Residential-Proxy-Method';
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${schedule.githubFileName}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            dynamic_message: finalMessage,
            code_message: codeMessage,
            reminder_tasks: JSON.stringify(reminderTasks)
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[Scheduler] Failed to trigger ${schedule.githubFileName}:`, errorData);
      } else {
        console.log(`[Scheduler] Successfully triggered GitHub workflow for ${schedule.scheduleName}`);
        // We no longer mark it as isSent=true here.
        // It will organically stop being the "closest upcoming" once the date actually passes!
      }
    } catch (error) {
      console.error(`[Scheduler] Error triggering workflow:`, error);
    }
  }

  async reloadWeeklyCodeDispatch() {
    try {
      const AppSetting = require('../models/AppSetting');
      const setting = await AppSetting.findOne({ key: 'weekly_code_config' });
      
      if (this.weeklyCodeDispatchCronJob) {
        this.weeklyCodeDispatchCronJob.stop();
        this.weeklyCodeDispatchCronJob = null;
        console.log('[Scheduler] Stopped existing Weekly Code Dispatch Cron.');
      }

      if (setting && setting.value && setting.value.enableDispatch && setting.value.dispatchCron && setting.value.dispatchUrl) {
        this.weeklyCodeDispatchCronJob = cron.schedule(setting.value.dispatchCron, async () => {
          console.log('[Scheduler] Running Weekly Code Dispatch...');
          await this.dispatchWeeklyCode();
        }, { scheduled: true, timezone: "Asia/Manila" });
        console.log(`[Scheduler] Weekly Code Dispatch cron initialized (${setting.value.dispatchCron}).`);
      }
    } catch (e) {
      console.error('[Scheduler] Error reloading Weekly Code Dispatch Cron:', e.message);
    }
  }

  async dispatchWeeklyCode() {
    try {
      const AppSetting = require('../models/AppSetting');
      const setting = await AppSetting.findOne({ key: 'weekly_code_config' });
      if (!setting || !setting.value || !setting.value.enableDispatch || !setting.value.dispatchUrl) {
        return;
      }

      const { currentCode, dispatchUrl, dispatchMessage } = setting.value;
      const codeToUse = currentCode || 'NOT_GENERATED';
      let message = dispatchMessage || 'Here is the code: {WeeklyCode}';
      
      message = message.replace(/{WeeklyCode}/gi, codeToUse);

      const owner = 'd0ul0s';
      const repo = 'Residential-Proxy-Method';
      const githubFileName = 'send-weekly-code.yml';
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${githubFileName}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            target_url: dispatchUrl,
            message: message
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[Scheduler] Failed to trigger ${githubFileName}:`, errorData);
      } else {
        console.log(`[Scheduler] Successfully dispatched Weekly Code to ${dispatchUrl}`);
      }
    } catch (e) {
      console.error('[Scheduler] Error dispatching Weekly Code:', e.message);
    }
  }
}

// Export a singleton instance
module.exports = new AutomationScheduler();
