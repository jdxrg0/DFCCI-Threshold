/* Telling a human that the automation broke.
 *
 * Every failure in this module was previously silent-by-omission: visible in
 * the dashboard to anyone who thought to look, and invisible otherwise. A week
 * of nobody receiving their reminder looked exactly like a week that worked.
 * These alerts are the difference between "we found out on Sunday" and "we
 * found out at 12:01". */

const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');

const APP_URL = () => process.env.FRONTEND_URL || '';

/* One alert per schedule per failure kind per window. The daily REMINDER cron
   plus a retry means a single broken login could otherwise produce a dozen
   near-identical emails before anyone reads the first one. */
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const lastAlertAt = new Map();

const onCooldown = (key) => {
  const previous = lastAlertAt.get(key);
  if (previous && Date.now() - previous < ALERT_COOLDOWN_MS) return true;
  lastAlertAt.set(key, Date.now());
  return false;
};

/* Admins are the only people who can act on any of this. ADMIN_EMAIL is the
   fallback so an alert still goes somewhere if the user lookup fails. */
const recipients = async () => {
  const addresses = new Set();
  try {
    const admins = await User.find({ role: 'ADMIN' }).select('email').lean();
    admins.forEach(a => a.email && addresses.add(a.email));
  } catch (e) {
    console.error('[Alerts] Could not load admin emails:', e.message);
  }
  if (addresses.size === 0 && process.env.ADMIN_EMAIL) addresses.add(process.env.ADMIN_EMAIL);
  return [...addresses];
};

const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const row = (label, value) => value
  ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;">${escapeHtml(label)}</td>
       <td style="padding:4px 0;color:#0f172a;"><strong>${escapeHtml(value)}</strong></td></tr>`
  : '';

const shell = (heading, lead, rows, actions) => `
  <h3 style="margin:0 0 8px;color:#b91c1c;font-size:17px;">${escapeHtml(heading)}</h3>
  <p style="margin:0 0 16px;">${lead}</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:18px;">${rows}</table>
  ${actions}
`;

const send = async (subject, html) => {
  const to = await recipients();
  if (to.length === 0) {
    console.warn('[Alerts] No admin address to notify — alert not sent.');
    return;
  }
  // Sequential rather than Promise.all: the Apps Script proxy is a single
  // Gmail account and does not love parallel bursts.
  for (const address of to) {
    const result = await sendEmail(address, subject, html);
    if (result && result.dev) {
      console.warn(`[Alerts] APPS_SCRIPT_URL is not set — the alert to ${address} was logged, NOT delivered.`);
    } else if (result && !result.ok) {
      console.error(`[Alerts] Could not deliver the alert to ${address}: ${result.error}`);
    }
  }
};

const dashboardLink = () => {
  const base = APP_URL();
  if (!base) return '';
  return `<p style="margin:0;"><a href="${escapeHtml(base)}/admin/automation"
    style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
    Open the Automation Hub</a></p>`;
};

/**
 * A dispatch never reached GitHub — a bad token, a missing workflow file, the
 * API being down. Nothing was sent and nothing will retry on its own.
 */
const alertDispatchFailure = async (schedule, record) => {
  if (onCooldown(`dispatch:${schedule._id}:${record.actionType}`)) return;

  await send(
    `⚠️ Automation failed: ${schedule.scheduleName}`,
    shell(
      'A scheduled message was not sent',
      `<strong>${escapeHtml(schedule.scheduleName)}</strong> tried to run and could not reach GitHub, so nothing was delivered.`,
      row('Schedule', schedule.scheduleName)
      + row('What ran', record.actionType)
      + row('Triggered by', record.trigger === 'manual' ? 'Manual "Send now"' : 'Scheduled cron')
      + row('When', new Date(record.at || Date.now()).toUTCString())
      + row('Reason', record.detail),
      dashboardLink()
    )
  );
};

/**
 * The dispatch worked, GitHub ran the bot, and the bot failed — by far the
 * most likely real-world failure, and the one nothing used to notice, because
 * the run's outcome only exists minutes after a dispatch already recorded
 * itself a success.
 */
const alertRunFailure = async (schedule, record) => {
  if (onCooldown(`run:${schedule._id}:${record.ghRunId || record.actionType}`)) return;

  const cookieHint = `
    <p style="margin:0 0 16px;color:#475569;font-size:13px;">
      The most common cause is the bot's Facebook session expiring. Open the run below and check the
      <em>debug-screenshot</em> artifact — if it shows a Facebook login or "Continue as…" screen, the
      <code>FACEBOOK_COOKIES</code> secret needs re-exporting. That artifact is deleted after 1 day.
    </p>`;

  const runLink = record.ghRunUrl
    ? `<p style="margin:0 0 10px;"><a href="${escapeHtml(record.ghRunUrl)}"
         style="background:#b91c1c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
         View the failed run on GitHub</a></p>`
    : '';

  await send(
    `🚨 Message NOT delivered: ${schedule.scheduleName}`,
    shell(
      'The bot ran but did not deliver the message',
      `<strong>${escapeHtml(schedule.scheduleName)}</strong> was dispatched successfully, but the run that sends the message finished as <strong>${escapeHtml(record.ghRunConclusion || 'failed')}</strong>.`,
      row('Schedule', schedule.scheduleName)
      + row('What ran', record.actionType)
      + row('Dispatched', new Date(record.at || Date.now()).toUTCString())
      + row('Outcome', record.ghRunConclusion || 'failed')
      + row('Recipients expected', record.recipients),
      cookieHint + runLink + dashboardLink()
    )
  );
};

/**
 * A scheduled time passed while the server was not running. Cron timers only
 * fire in a live process, and nothing catches up afterwards, so this is the
 * only way a skipped week is ever mentioned.
 */
const alertMissedRuns = async (missed) => {
  if (missed.length === 0) return;
  if (onCooldown('missed:startup')) return;

  const rows = missed.map(m =>
    row(m.scheduleName, `${new Date(m.expectedAt).toUTCString()} — never ran`)).join('');

  await send(
    `⚠️ ${missed.length} scheduled automation run${missed.length === 1 ? '' : 's'} were missed`,
    shell(
      'A scheduled run was missed while the server was down',
      'The backend was not running when these were due. Cron timers only fire in a live process and nothing '
      + 'catches up automatically, so these messages were never sent. Send them manually if they still matter.',
      rows,
      dashboardLink()
    )
  );
};

module.exports = { alertDispatchFailure, alertRunFailure, alertMissedRuns, ALERT_COOLDOWN_MS };
