const User = require('../models/User');
const DuesMember = require('../models/DuesMember');
const DuesPayment = require('../models/DuesPayment');
const sendEmail = require('./sendEmail');

const START_DATE = new Date('2026-05-01');

/**
 * Calculates current arrears for a user by matching their display name to the roster.
 */
const calculateArrears = async (displayName) => {
  try {
    const member = await DuesMember.findOne({ 
      name: new RegExp('^' + displayName + '$', 'i'), 
      isActive: true 
    });
    
    if (!member) return null;

    const payments = await DuesPayment.find({ member: member._id });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const now = new Date();
    let sundaysCount = 0;
    let d = new Date(START_DATE);
    while (d <= now) {
      if (d.getDay() === 0) sundaysCount++;
      d.setDate(d.getDate() + 1);
    }

    const expected = sundaysCount * 10;
    return expected - totalPaid;
  } catch (err) {
    console.error('[Arrears Calc Error]', err);
    return null;
  }
};

const arrearsText = (arrears, isSunday = false) => {
  if (arrears === null) return "Don't forget to check the Fund Tracker to see your dues status! 📖";
  
  if (arrears > 0) {
    return `Your current arrears is <span style="color: #ef4444; font-weight: bold;">₱${arrears}</span> ${isSunday ? '(including today)' : ''}. Let's settle it soon! 🙏`;
  } else if (arrears < 0) {
    return `You're advanced by <span style="color: #f59e0b; font-weight: bold;">₱${Math.abs(arrears)}</span>! You're all caught up and then some — great job! 🎉`;
  } else {
    return `You're <span style="color: #22c55e; font-weight: bold;">Fully Updated</span>! No arrears at all — keep it up! ✨`;
  }
};

const SATURDAY_TEMPLATES = [
  {
    subject: "Reminder: Tomorrow is Sunday! 😊",
    title: "Saturday Reminder ✨",
    body: (name, arrears) => `Hi <strong>${name}</strong>! Just a heads-up — tomorrow is Sunday and dues day. ${arrearsText(arrears)} Please prepare your ₱10. See you tomorrow! 👋`
  },
  {
    subject: "Don't forget your dues tomorrow! 📖",
    title: "Reminder: The Ledger is Calling! 📖",
    body: (name, arrears) => `Hi <strong>${name}</strong>! A friendly reminder that tomorrow is Sunday. ${arrearsText(arrears)} Please have your ₱10 ready so we can keep the community fund going strong. See you! 🙏`
  },
  {
    subject: "Saturday Night Reminder! 🌙",
    title: "Dues Reminder 🫡",
    body: (name, arrears) => `Hi <strong>${name}</strong>! Before the night ends, just a reminder that tomorrow is dues day. ${arrearsText(arrears)} Don't forget your ₱10. See you at the gathering! ✨`
  }
];

const SUNDAY_TEMPLATES = [
  {
    subject: "Happy Sunday! Dues day reminder ✨",
    title: "Sunday Fund Day! 💰",
    body: (name, arrears) => `Good morning, <strong>${name}</strong>! ☀️ Today is Sunday — time to pay your dues. ${arrearsText(arrears, true)} See you at the gathering! 🙏`
  },
  {
    subject: "Sunday Morning Reminder! ☀️",
    title: "Blessed Sunday! ⛪️",
    body: (name, arrears) => `Happy Sunday, <strong>${name}</strong>! Don't forget your ₱10 contribution today. ${arrearsText(arrears, true)} Have a blessed day and see you later! 😇`
  },
  {
    subject: "It's Sunday — gathering day! ⛪️",
    title: "Gathering Day! 🤝",
    body: (name, arrears) => `Good morning, <strong>${name}</strong>! Today is Sunday and gathering day. ${arrearsText(arrears, true)} Please bring your ₱10 dues. Stay blessed! ✨`
  }
];

/**
 * Sends dues reminders to all subscribed and verified users.
 */
const sendDuesReminders = async (timing) => {
  try {
    const users = await User.find({
      isVerified: true,
      subscribedToDuesReminders: true
    });

    if (users.length === 0) return;

    const now = new Date();
    const weekNum = Math.floor((now - START_DATE) / (7 * 24 * 60 * 60 * 1000));
    
    const templates = timing === 'Saturday Night' ? SATURDAY_TEMPLATES : SUNDAY_TEMPLATES;
    const template = templates[weekNum % templates.length];

    for (const user of users) {
      const arrears = await calculateArrears(user.displayName);
      
      const html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 30px; border-radius: 20px; background: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="background: #0284c7; color: white; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; font-size: 30px; margin: 0 auto 15px;">💰</div>
            <h2 style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 800;">${template.title}</h2>
          </div>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
            ${template.body(user.displayName, arrears)}
          </p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 15px; margin: 25px 0; text-align: center; border: 1px dashed #cbd5e1;">
            <span style="display: block; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Weekly Dues</span>
            <span style="font-size: 32px; font-weight: 900; color: #0284c7;">₱10.00</span>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            You are receiving this because you're a verified member of <strong>DFCCI Threshold</strong>. Keep glowing! ✨
          </p>
        </div>
      `;

      await sendEmail(user.email, template.subject, html);
    }
  } catch (error) {
    console.error(`[Scheduler] Error in ${timing} reminder job:`, error);
  }
};

/**
 * Initializes the reminder scheduler.
 */
const initReminderScheduler = () => {
  console.log('[Scheduler] Dues Reminder Scheduler initialized.');
  let lastSentDateStr = '';

  setInterval(async () => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dateStr = now.toDateString();

    // Saturday 10 PM
    if (day === 6 && hours === 22 && minutes === 0 && lastSentDateStr !== `${dateStr}-Sat`) {
      lastSentDateStr = `${dateStr}-Sat`;
      await sendDuesReminders('Saturday Night');
    }

    // Sunday 6 AM
    if (day === 0 && hours === 6 && minutes === 0 && lastSentDateStr !== `${dateStr}-Sun`) {
      lastSentDateStr = `${dateStr}-Sun`;
      await sendDuesReminders('Sunday Morning');
    }
  }, 60000);
};

module.exports = { initReminderScheduler };
