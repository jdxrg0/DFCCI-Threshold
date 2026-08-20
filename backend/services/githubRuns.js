/* Correlating a dispatch with the GitHub Actions run it produced.
   `workflow_dispatch` answers 204 with no body, so the run id simply does not
   exist yet at dispatch time — it becomes visible seconds to tens of seconds
   later. Everything here therefore runs after the fact, never on the dispatch
   path, so a lookup failure can never turn a successful send into a failure. */

const { GH_OWNER, GH_REPO, GH_BRANCH, API_ROOT, ghHeaders, hasPat } = require('./github');

/* GitHub's `created` filter and `created_at` are both second-resolution, so the
   floor is truncated down and compared with >= — a run created inside the same
   second as the dispatch must not be filtered out. */
const floorSec = (d) => new Date(Math.floor(new Date(d).getTime() / 1000) * 1000);

/**
 * Runs of one workflow file created at or after `since`, newest-first.
 *
 * @returns {Promise<{state: 'ok'|'pending'|'unavailable', runs: object[]}>}
 *   'unavailable' — the token is absent, or cannot read Actions (403, or the
 *   404 GitHub returns instead of 403 on a private repo); asking again will
 *   not help.
 *   'pending'     — transient (429/5xx); the caller should retry later.
 */
const listRunsSince = async (workflowFile, since) => {
  // No token is a permanent condition for this request, not a transient one:
  // reporting it as pending would have every history read retry forever.
  if (!hasPat()) return { state: 'unavailable', runs: [] };

  const url = new URL(`${API_ROOT}/actions/workflows/${encodeURIComponent(workflowFile)}/runs`);
  url.searchParams.set('event', 'workflow_dispatch');
  url.searchParams.set('branch', GH_BRANCH);
  url.searchParams.set('created', `>=${floorSec(since).toISOString()}`);
  url.searchParams.set('exclude_pull_requests', 'true');
  url.searchParams.set('per_page', '20');

  // A hung lookup would hold the admin's /runs request open; the stored rows are
  // always good enough to answer with, so give up quickly and retry next time.
  const response = await fetch(url, {
    headers: ghHeaders(),
    signal: AbortSignal.timeout(8000)
  });

  // GitHub answers 403 both for "this token cannot read Actions" and for a spent
  // rate limit. Only the first is permanent, and the remaining-count tells them
  // apart — treating a rate limit as permanent would strand every pending row.
  if (response.status === 403 || response.status === 404) {
    const exhausted = response.headers.get('x-ratelimit-remaining') === '0';
    return { state: exhausted ? 'pending' : 'unavailable', runs: [] };
  }
  if (!response.ok) return { state: 'pending', runs: [] };

  const body = await response.json();
  return { state: 'ok', runs: body.workflow_runs || [] };
};

module.exports = { GH_OWNER, GH_REPO, ghHeaders, floorSec, listRunsSince };
