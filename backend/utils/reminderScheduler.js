const User = require('../models/User');
const DuesMember = require('../models/DuesMember');
const DuesPayment = require('../models/DuesPayment');
const Devotional = require('../models/Devotional');
const sendEmail = require('./sendEmail');

const START_DATE = new Date('2026-05-01');

/**
 * Calculates current arrears for a user.
 */
// displayName is user-controlled and went straight into a RegExp. A name
// containing regex metacharacters ("A. (Jr)") threw or matched the wrong row;
// a crafted one could match everybody.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The one definition of which roster row belongs to a user account.
 *
 * Exported because the reminder preview endpoint has to resolve members the
 * exact same way — when it only checked linkedUser, the preview showed "no
 * roster" for people the email then greeted with a real balance.
 */
const resolveRosterMember = async (user) => {
  if (!user) return null;
  return DuesMember.findOne({
    $or: [
      { linkedUser: user._id },
      { name: new RegExp('^' + escapeRegex(user.displayName || '') + '$', 'i') },
    ],
    isActive: true,
  });
};

const calculateArrears = async (user) => {
  try {
    const member = await resolveRosterMember(user);

    if (!member) return null;

    const payments = await DuesPayment.find({ member: member._id });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const nowSystem = new Date();
    const now = new Date(nowSystem.getTime() + 8 * 60 * 60 * 1000);
    now.setUTCHours(0, 0, 0, 0);
    let sundaysCount = 0;
    let d = new Date(START_DATE.getTime() + 8 * 60 * 60 * 1000);
    d.setUTCHours(0, 0, 0, 0);
    while (d <= now) {
      if (d.getUTCDay() === 0) sundaysCount++;
      d.setUTCDate(d.getUTCDate() + 1);
    }

    const expected = sundaysCount * 10;
    return expected - totalPaid;
  } catch (err) {
    console.error('[Arrears Calc Error]', err);
    return null;
  }
};

const arrearsHtml = (arrears) => {
  if (arrears === null) return `Don't forget to check the Fund Tracker to see your dues status!`;

  if (arrears > 0) {
    return `Your current dues balance is <span style="color:#ef4444;font-weight:bold;">₱${arrears} in arrears</span>. Please settle it at your earliest convenience.`;
  } else if (arrears < 0) {
    return `You're advanced by <span style="color:#f59e0b;font-weight:bold;">₱${Math.abs(arrears)}</span>! You're all caught up and then some — great job!`;
  } else {
    return `You're <span style="color:#22c55e;font-weight:bold;">Fully Updated</span>! No arrears at all — keep it up!`;
  }
};

// Day-neutral wording, matching the one-off statement sent from the roster.
const MANUAL_TEMPLATE = {
  subject: 'Your dues statement',
  greeting: (name) => `Hi <strong>${name}</strong>! Here's where your weekly dues stand as of today.`,
};

const SATURDAY_TEMPLATES = [
  {
    subject: "Reminder: Tomorrow is Sunday!",
    greeting: (name) => `Hi <strong>${name}</strong>! Just a heads-up — tomorrow is Sunday and dues day. Please prepare your ₱10. See you tomorrow!`
  },
  {
    subject: "Don't forget your dues tomorrow!",
    greeting: (name) => `Hi <strong>${name}</strong>! A friendly reminder that tomorrow is Sunday. Please have your ₱10 ready so we can keep the community fund going strong. See you!`
  },
  {
    subject: "Saturday Night Reminder!",
    greeting: (name) => `Hi <strong>${name}</strong>! Before the night ends, just a reminder that tomorrow is dues day. Don't forget your ₱10. See you at the gathering!`
  }
];

const SUNDAY_TEMPLATES = [
  {
    subject: "Happy Sunday! Dues day reminder",
    greeting: (name) => `Good morning, <strong>${name}</strong>! Today is Sunday — time to pay your dues. See you at the gathering!`
  },
  {
    subject: "Sunday Morning Reminder!",
    greeting: (name) => `Happy Sunday, <strong>${name}</strong>! Don't forget your ₱10 contribution today. Have a blessed day and see you later!`
  },
  {
    subject: "It's Sunday — gathering day!",
    greeting: (name) => `Good morning, <strong>${name}</strong>! Today is Sunday and gathering day. Please bring your ₱10 dues. Stay blessed!`
  }
];

/**
 * Sends dues reminders to all subscribed and verified users.
 */
const sendDuesReminders = async (timing) => {
  // Returns a per-run summary so a manual trigger can report what actually
  // happened instead of an unconditional "success". The cron callers ignore it.
  const result = { timing, attempted: 0, sent: 0, failed: 0, subject: '', dev: false, errors: [] };
  try {
    const users = await User.find({
      isVerified: true,
      subscribedToDuesReminders: true
    });

    if (users.length === 0) return result;
    result.attempted = users.length;

    const nowSystem = new Date();
    const now = new Date(nowSystem.getTime() + 8 * 60 * 60 * 1000);
    const weekNum = Math.floor((now - START_DATE) / (7 * 24 * 60 * 60 * 1000));
    
    // A manual send can happen on any weekday, so it must not reuse the
    // Saturday copy that opens with "Tomorrow is Sunday!".
    let template;
    if (timing === 'Manual') {
      template = MANUAL_TEMPLATE;
    } else {
      const templates = timing === 'Saturday Night' ? SATURDAY_TEMPLATES : SUNDAY_TEMPLATES;
      template = templates[weekNum % templates.length];
    }
    result.subject = template.subject;

    for (const user of users) {
      const arrears = await calculateArrears(user);

      const html = `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f8fafc;padding:20px 0;font-family:sans-serif;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #f0f0f0;border-radius:20px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.07);">
                <tr>
                  <td align="center" style="padding-bottom:25px;">
                    <h2 style="color:#1e293b;margin:0;font-size:24px;font-weight:800;font-family:sans-serif;">Your Dues Statement</h2>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color:#475569;font-size:16px;line-height:1.6;padding-bottom:20px;font-family:sans-serif;">
                    ${template.greeting(user.displayName)}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <table border="0" cellpadding="20" cellspacing="0" width="100%" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:15px;">
                      <tr>
                        <td align="center">
                          <span style="display:block;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:sans-serif;">Weekly Dues Balance</span>
                          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0;font-family:sans-serif;">
                            ${arrearsHtml(arrears)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color:#94a3b8;font-size:12px;padding-top:20px;font-family:sans-serif;">
                    This is an official statement from <strong>DFCCI Threshold</strong>. Keep shining!
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      // sendEmail swallows its own failures and returns an outcome rather than
      // throwing, so check the flag. The try/catch is only for the unexpected.
      try {
        const outcome = await sendEmail(user.email, template.subject, html);
        if (outcome?.dev) result.dev = true;
        if (outcome?.ok === false) {
          result.failed += 1;
          result.errors.push({ email: user.email, message: outcome.error || 'Unknown send failure' });
        } else {
          result.sent += 1;
        }
      } catch (err) {
        result.failed += 1;
        result.errors.push({ email: user.email, message: err.message });
        console.error(`[Scheduler] Failed to send dues reminder to ${user.email}:`, err.message);
      }
    }
  } catch (error) {
    console.error(`[Scheduler] Error in ${timing} reminder job:`, error);
    result.errors.push({ email: '*', message: error.message });
  }
  return result;
};

/**
 * Sends devotional streak reminders to users who are about to break their streak.
 * @param {number} hoursLeft - The number of hours left before the UTC day ends.
 * @param {string|null} targetMemberId - Specific member ID to trigger reminder for immediately.
 */
const sendDevotionalStreakReminders = async (hoursLeft, targetMemberId = null) => {
  try {
    console.log(`[Scheduler] Checking devotional streaks. ${hoursLeft} hour(s) left before the next day.`);
    
    let usersAtRisk = [];

    if (targetMemberId) {
      console.log(`[Scheduler] Forcing devotional streak reminder for specific member: ${targetMemberId}`);
      const user = await User.findById(targetMemberId);
      if (user && user.isVerified) {
        usersAtRisk = [user];
      }
    } else {
      // Normalize today and yesterday to midnight UTC+8 representation
      const now = new Date();
      const today = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      today.setUTCHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      // Fetch all devotionals submitted today and yesterday
      const [todayEntries, yesterdayEntries] = await Promise.all([
        Devotional.find({ date: today }).select('member').lean(),
        Devotional.find({ date: yesterday }).select('member').lean()
      ]);

      const todaySet = new Set(todayEntries.map(e => e.member.toString()));
      const yesterdaySet = new Set(yesterdayEntries.map(e => e.member.toString()));

      // Find users who:
      // 1. Submitted yesterday (have an active streak)
      // 2. Did NOT submit today (streak is at risk)
      // 3. Are verified and active
      const atRiskUserIds = [...yesterdaySet].filter(memberIdStr => !todaySet.has(memberIdStr));

      if (atRiskUserIds.length > 0) {
        usersAtRisk = await User.find({
          _id: { $in: atRiskUserIds },
          isVerified: true
        });
      }
    }

    if (usersAtRisk.length === 0) {
      console.log('[Scheduler] No users found for devotional streak reminders.');
      return 0;
    }

    let sentCount = 0;

    for (const user of usersAtRisk) {
      const timeWord = hoursLeft === 1 ? '1 hour' : `${hoursLeft} hours`;

      // Send email reminder
      const subject = `Keep your Devotional Streak alive! (Only ${timeWord} left)`;
      
      // Gorgeous premium email design
      const html = `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#020617;padding:20px 0;font-family:sans-serif;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.15);">
                <tr>
                  <td align="center" style="padding-bottom:25px;">
                    <h2 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;font-family:sans-serif;">Keep Your Streak Burning!</h2>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color:#cbd5e1;font-size:16px;line-height:1.6;padding-bottom:25px;font-family:sans-serif;">
                    Hi <strong>${user.displayName}</strong>, you are doing incredibly well keeping up your daily devotional habit! 
                    However, we noticed you haven't logged your passage for today yet.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:25px;">
                    <table border="0" cellpadding="20" cellspacing="0" width="100%" style="background-color:#1e293b;border:1px dashed #475569;border-radius:15px;">
                      <tr>
                        <td align="center">
                          <span style="display:block;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-family:sans-serif;">Time Remaining</span>
                          <p style="color:#f59e0b;font-size:22px;font-weight:bold;margin:0;font-family:sans-serif;">
                            Only ${timeWord} left!
                          </p>
                          <p style="color:#94a3b8;font-size:14px;margin-top:5px;margin:0;font-family:sans-serif;">
                            Before the next day starts (at 12:00 AM UTC+8)
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color:#94a3b8;font-size:14px;line-height:1.6;padding-bottom:25px;font-family:sans-serif;">
                    Spend a few quiet moments with the Lord, write down your takeaways, and submit your devotional to protect your streak and stay accountable!
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:25px;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/devotionals/submit" style="display:inline-block;padding:14px 30px;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;box-shadow:0 4px 15px rgba(245, 158, 11, 0.4);font-family:sans-serif;">
                      Write My Devotional Now
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color:#64748b;font-size:11px;border-top:1px solid #1e293b;padding-top:20px;font-family:sans-serif;">
                    This is an automated encouragement from <strong>DFCCI Threshold Devotional Tracker</strong>.<br/>
                    "Your word is a lamp to my feet and a light to my path." — Psalm 119:105
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      await sendEmail(user.email, subject, html);
      sentCount++;
    }

    console.log(`[Scheduler] Devotional streak reminders sent successfully to ${sentCount} user(s).`);
    return sentCount;
  } catch (error) {
    console.error('[Scheduler] Error sending devotional streak reminders:', error);
    throw error;
  }
};

/**
 * Initializes the reminder scheduler.
 */
const initReminderScheduler = () => {
  console.log('[Scheduler] Dues Reminder Scheduler initialized.');
  let lastSentDateStr = '';
  let lastSentDevotionalDateStr = '';

  setInterval(async () => {
    const now = new Date();
    
    // Shift current time to UTC+8
    const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const day = utc8Time.getUTCDay();
    const hours = utc8Time.getUTCHours();
    const minutes = utc8Time.getUTCMinutes();
    const dateStr = utc8Time.toISOString().slice(0, 10);

    // Saturday 9 PM (21:00 UTC+8)
    if (day === 6 && hours === 21 && minutes === 0 && lastSentDateStr !== `${dateStr}-Sat`) {
      lastSentDateStr = `${dateStr}-Sat`;
      await sendDuesReminders('Saturday Night');
    }

    // Sunday 6 AM (06:00 UTC+8)
    if (day === 0 && hours === 6 && minutes === 0 && lastSentDateStr !== `${dateStr}-Sun`) {
      lastSentDateStr = `${dateStr}-Sun`;
      await sendDuesReminders('Sunday Morning');
    }

    // Devotional Streak Reminders (UTC+8 based)
    // 3 hours before next day (21:00 UTC+8)
    if (hours === 21 && minutes === 0 && lastSentDevotionalDateStr !== `${dateStr}-3h`) {
      lastSentDevotionalDateStr = `${dateStr}-3h`;
      await sendDevotionalStreakReminders(3);
    }

    // 1 hour before next day (23:00 UTC+8)
    if (hours === 23 && minutes === 0 && lastSentDevotionalDateStr !== `${dateStr}-1h`) {
      lastSentDevotionalDateStr = `${dateStr}-1h`;
      await sendDevotionalStreakReminders(1);
    }
  }, 60000);
};

module.exports = {
  resolveRosterMember, initReminderScheduler, sendDuesReminders, sendDevotionalStreakReminders };
