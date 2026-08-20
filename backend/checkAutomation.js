#!/usr/bin/env node
/**
 * Answers "why is the Automation Hub not sending anything?" from the command
 * line, without needing the server up or an admin session.
 *
 *   node backend/checkAutomation.js
 *
 * Run it wherever the backend runs. It reads the same environment the server
 * does, so running it locally tells you about your local .env — to check the
 * deployed backend, run it there, or call GET /api/automation/health as an
 * admin against that host.
 */

require('dotenv').config({ path: __dirname + '/.env' });

const github = require('./services/github');
const { WEEKLY_CODE_WORKFLOW } = require('./services/weeklyCodeWorkflow');

const tick = (value) => (value === true ? '  OK  ' : value === false ? ' FAIL ' : '  ??  ');
const line = (label, value, note) =>
  console.log(`[${tick(value)}] ${label}${note ? ' — ' + note : ''}`);

const main = async () => {
  console.log('\nAutomation Hub — dependency check');
  console.log('='.repeat(62));

  // ── Environment ────────────────────────────────────────────────────────
  console.log('\nEnvironment');
  line('MONGODB_URI', Boolean(process.env.MONGODB_URI),
    process.env.MONGODB_URI ? 'set' : 'missing — the scheduler cannot load any schedule');
  line('GITHUB_PAT', github.hasPat(),
    github.hasPat() ? 'set' : 'MISSING — nothing can be created, edited or dispatched');
  line('BOT_WEBHOOK_SECRET', Boolean(process.env.BOT_WEBHOOK_SECRET),
    process.env.BOT_WEBHOOK_SECRET
      ? 'set — the reader bot must send it as x-bot-secret'
      : 'not set — /api/submissions/report is accepting unauthenticated reports');

  // ── GitHub ─────────────────────────────────────────────────────────────
  console.log(`\nGitHub (${github.GH_OWNER}/${github.GH_REPO}@${github.GH_BRANCH})`);
  const probe = await github.probe();

  line('Token present', probe.tokenPresent);
  if (probe.tokenPresent) {
    line('Token accepted', probe.tokenValid);
    line('Token scopes', probe.tokenScopes ? true : null,
      probe.tokenScopes || 'not reported (fine-grained token)');
    line('Can write to the repo', probe.canPush);
    line('Can read Actions', probe.canReadActions);
    if (probe.rateLimitRemaining !== null) {
      console.log(`         API calls left this hour: ${probe.rateLimitRemaining}`);
    }
  }

  if (probe.workflowFiles) {
    console.log(`\nWorkflow files on the repo (${probe.workflowFiles.length})`);
    probe.workflowFiles.forEach(f => console.log('         - ' + f));
    line(WEEKLY_CODE_WORKFLOW, probe.workflowFiles.includes(WEEKLY_CODE_WORKFLOW),
      probe.workflowFiles.includes(WEEKLY_CODE_WORKFLOW)
        ? 'present'
        : 'absent — it is created automatically on the next weekly-code dispatch');
  }

  // ── Schedules ──────────────────────────────────────────────────────────
  // Optional: the GitHub half of the report is worth having on its own, so a
  // database that is unreachable must not take the whole check down.
  if (process.env.MONGODB_URI) {
    console.log('\nSchedules');
    const mongoose = require('mongoose');
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      const Schedule = require('./models/Schedule');
      const schedules = await Schedule.find().select('scheduleName cronTime isActive githubFileName lastRun').lean();

      if (schedules.length === 0) {
        console.log('         No schedules exist yet — nothing is configured to send.');
      }
      schedules.forEach(s => {
        const present = probe.workflowFiles ? probe.workflowFiles.includes(s.githubFileName) : null;
        const state = s.isActive === false ? 'paused' : 'active';
        line(`${s.scheduleName} (${state}, ${s.cronTime})`, present,
          present === false ? `${s.githubFileName} is NOT on the repo — re-save the schedule`
            : present === null ? 'workflow presence unknown'
              : s.lastRun ? `last run ${s.lastRun.status} at ${new Date(s.lastRun.at).toISOString()}` : 'never run');
      });

      // A delete that could not reach GitHub leaves the file behind. Harmless,
      // but it makes the repo impossible to reconcile with the dashboard.
      const claimed = new Set(schedules.map(s => s.githubFileName));
      const orphans = (probe.workflowFiles || [])
        .filter(f => /^schedule-\d+\.yml$/.test(f) && !claimed.has(f));
      if (orphans.length > 0) {
        probe.problems.push(
          `${orphans.length} workflow file(s) on the repo belong to no schedule: ${orphans.join(', ')}. ` +
          'Safe to delete on GitHub.'
        );
      }

      // Enabled with no target looks configured in the UI, but the cron is
      // never registered and the dispatcher returns before doing anything.
      const AppSetting = require('./models/AppSetting');
      const wc = await AppSetting.findOne({ key: 'weekly_code_config' }).lean();
      if (wc && wc.value && wc.value.enableDispatch && !wc.value.dispatchUrl) {
        probe.problems.push(
          'Weekly code auto-dispatch is switched on but has no target chat URL, so it never runs. ' +
          'Set one in the weekly-code panel, or switch it off.'
        );
      }

      await mongoose.disconnect();
    } catch (e) {
      console.log(`         Could not read the database: ${e.message}`);
    }
  }

  // ── Verdict ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(62));
  if (probe.problems.length === 0) {
    console.log('No problems found.\n');
  } else {
    console.log(`${probe.problems.length} problem(s) found:\n`);
    probe.problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}\n`));
  }

  process.exit(probe.problems.length === 0 ? 0 : 1);
};

main().catch(err => {
  console.error('\nCheck failed to run:', err.message);
  process.exit(1);
});
