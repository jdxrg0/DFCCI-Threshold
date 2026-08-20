/* Matching a dispatch to the GitHub Actions run it produced, and noticing when
   that run failed.
 *
 * This used to live inside the /runs route, which meant it only ever ran when
 * an admin opened the history modal. That is fine for showing a link, but it
 * is useless for alerting: the most common real failure — the bot reaching
 * Facebook and not being logged in — happens minutes AFTER a dispatch that
 * already recorded itself as a success. Nobody would learn about it until they
 * happened to look. The watcher cron in automationScheduler now calls this on
 * a timer, so the outcome is discovered whether or not anyone is watching. */

const Schedule = require('../models/Schedule');
const { floorSec, listRunsSince } = require('./githubRuns');

// A run that has not surfaced within a day never will, so stop asking for it.
const GH_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const GH_RUNS_CACHE_MS = 15 * 1000;
const ghRunsCache = new Map();

/* Opening the history modal twice in a row must not cost two GitHub calls. */
const cachedRunsSince = async (workflowFile, since) => {
  const key = `${workflowFile}|${since.toISOString()}`;
  const hit = ghRunsCache.get(key);
  if (hit && Date.now() - hit.at < GH_RUNS_CACHE_MS) return hit.result;

  const result = await listRunsSince(workflowFile, since);
  for (const [cached, entry] of ghRunsCache) {
    if (Date.now() - entry.at >= GH_RUNS_CACHE_MS) ghRunsCache.delete(cached);
  }
  ghRunsCache.set(key, { at: Date.now(), result });
  return result;
};

/**
 * Attach GitHub Actions run links to a schedule's history, lazily.
 *
 * A dispatch only records that it fired and when — the run it produced is not
 * visible for seconds to tens of seconds afterwards — so the matching happens
 * here and costs at most one GitHub request.
 * Mutates the loaded document so the response carries whatever was resolved.
 *
 * @returns {Promise<object[]>} rows that have just been seen to finish badly.
 *   Only rows that were not already known to have failed are returned, so a
 *   caller can alert on them exactly once.
 */
const enrichRunLinks = async (schedule) => {
  const history = schedule.runHistory || [];
  if (!schedule.githubFileName || history.length === 0) return [];

  const writes = [];
  const stage = (row, fields) => {
    Object.assign(row, fields);
    writes.push({ row, fields });
  };

  const pending = [];
  const refreshing = [];
  const now = Date.now();

  for (const row of history) {
    if (row.ghRunId && row.ghRunStatus !== 'completed') { refreshing.push(row); continue; }
    if (row.ghLookupState !== 'pending' || !row.ghDispatchedAt) continue;
    if (now - new Date(row.ghDispatchedAt).getTime() > GH_PENDING_TTL_MS) {
      stage(row, { ghLookupState: 'not_found' });
      continue;
    }
    pending.push(row);
  }

  const newlyFailed = [];
  const needed = [...pending, ...refreshing];

  if (needed.length > 0) {
    const since = new Date(Math.min(...needed.map(r => new Date(r.ghDispatchedAt || r.at).getTime())));
    const { state, runs } = await cachedRunsSince(schedule.githubFileName, since);

    if (state === 'unavailable') {
      // The token cannot read Actions. A dispatch that worked must not start
      // looking like a failure because its link could not be fetched.
      pending.forEach(row => stage(row, { ghLookupState: 'unavailable' }));
    } else if (state === 'ok') {
      const byRunId = new Map(runs.map(r => [r.id, r]));
      for (const row of refreshing) {
        const run = byRunId.get(row.ghRunId);
        if (!run) continue;
        stage(row, { ghRunStatus: run.status, ghRunConclusion: run.conclusion || '' });
        if (run.status === 'completed' && run.conclusion && run.conclusion !== 'success' && !row.alerted) {
          newlyFailed.push(row);
        }
      }

      // Run ids increase monotonically per repository, so demanding an id above
      // every one already claimed makes it impossible to hand a row last week's
      // run — every schedule reuses one workflow file for years.
      let minRunId = history.reduce((max, r) => (r.ghRunId > max ? r.ghRunId : max), 0);
      const oldestFirst = [...pending].sort((a, b) => new Date(a.at) - new Date(b.at));

      for (const row of oldestFirst) {
        const floor = floorSec(row.ghDispatchedAt);
        const match = runs
          .filter(r => new Date(r.created_at) >= floor && r.id > minRunId)
          .sort((a, b) => a.id - b.id)[0];
        // No match means "not visible yet", never a guess: it stays pending and
        // resolves the next time this runs.
        if (!match) continue;
        minRunId = match.id;
        stage(row, {
          ghRunId: match.id,
          ghRunUrl: match.html_url,
          ghRunStatus: match.status,
          ghRunConclusion: match.conclusion || '',
          ghLookupState: 'resolved'
        });
        if (match.status === 'completed' && match.conclusion && match.conclusion !== 'success' && !row.alerted) {
          newlyFailed.push(row);
        }
      }
    }
  }

  const addressable = writes.filter(write => write.row._id);
  if (addressable.length === 0) return newlyFailed;

  // Positional filters rather than a whole-array write, so a dispatch landing
  // mid-enrichment is not clobbered.
  const $set = {};
  const arrayFilters = [];
  addressable.forEach((write, i) => {
    const alias = `r${i}`;
    arrayFilters.push({ [`${alias}._id`]: write.row._id });
    Object.entries(write.fields).forEach(([field, value]) => {
      $set[`runHistory.$[${alias}].${field}`] = value;
    });
  });

  const newest = history.reduce((a, b) => (new Date(b.at) > new Date(a.at) ? b : a));
  const newestWrite = addressable.find(write => write.row === newest);
  if (newestWrite) {
    Object.entries(newestWrite.fields).forEach(([field, value]) => {
      $set[`lastRun.${field}`] = value;
      if (typeof schedule.set === 'function') schedule.set(`lastRun.${field}`, value);
    });
  }

  await Schedule.updateOne({ _id: schedule._id }, { $set }, { arrayFilters });
  return newlyFailed;
};

/** Remember that a failed run has already been reported, so it is not re-sent. */
const markAlerted = async (scheduleId, rowId) => {
  if (!rowId) return;
  await Schedule.updateOne(
    { _id: scheduleId },
    { $set: { 'runHistory.$[r].alerted': true } },
    { arrayFilters: [{ 'r._id': rowId }] }
  );
};

module.exports = { enrichRunLinks, markAlerted, GH_PENDING_TTL_MS };
