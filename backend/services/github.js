/* The one place that knows how to talk to the bot repository.
 *
 * Every schedule in the Automation Hub is a workflow file in that repo, and
 * every dispatch is a `workflow_dispatch` against it. Owner, repo and token
 * used to be re-declared at each call site, which meant a token that was never
 * configured surfaced as GitHub's own "Bad credentials" at four unrelated
 * points — a 500 on schedule creation, a silent console line on the cron path.
 * Centralising it lets a missing token be one recognisable failure instead.
 */

const GH_OWNER = process.env.GITHUB_OWNER || 'd0ul0s';
const GH_REPO = process.env.GITHUB_REPO || 'Residential-Proxy-Method';
const GH_BRANCH = process.env.GITHUB_BRANCH || 'main';

const API_ROOT = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;
const CONTENTS_API = `${API_ROOT}/contents/.github/workflows`;

/* Read at call time, not at module load: dotenv runs in server.js, and a
   module required before it would capture an undefined token forever. */
const pat = () => process.env.GITHUB_PAT || '';
const hasPat = () => pat().length > 0;

/**
 * Thrown instead of letting an unauthenticated request reach GitHub, so the
 * failure names the actual cause. Routes turn this into a 503 with a message
 * an admin can act on, rather than a 500 quoting GitHub.
 */
class MissingPatError extends Error {
  constructor() {
    super(
      'GITHUB_PAT is not configured on the server, so nothing can be written to ' +
      'or dispatched from the bot repository. Set it in the backend environment ' +
      'and restart. Check /api/automation/health for the live state.'
    );
    this.name = 'MissingPatError';
    this.isMissingPat = true;
  }
}

const ghHeaders = () => ({
  'Authorization': `token ${pat()}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  'User-Agent': 'dfcci-threshold'
});

/* Guard for the write and dispatch paths. Read paths deliberately do not use
   this — they degrade to "unavailable" so a missing token can never turn a
   dispatch that already happened into something that renders as a failure. */
const assertPat = () => {
  if (!hasPat()) throw new MissingPatError();
};

/* ── Workflow files ─────────────────────────────────────────────────────── */

/** The live SHA of a workflow file, or null when it is not there. */
const getWorkflowSha = async (fileName) => {
  if (!hasPat()) return null;
  try {
    const res = await fetch(`${CONTENTS_API}/${fileName}`, {
      headers: ghHeaders(),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha || null;
  } catch (e) {
    console.warn(`[GitHub] Could not read ${fileName}: ${e.message}`);
    return null;
  }
};

/** Create or update a workflow file. Returns the new SHA. */
const putWorkflow = async (fileName, yaml, commitMessage, sha) => {
  assertPat();

  const body = {
    message: commitMessage,
    content: Buffer.from(yaml).toString('base64'),
    branch: GH_BRANCH
  };
  if (sha) body.sha = sha;

  const response = await fetch(`${CONTENTS_API}/${fileName}`, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `GitHub returned ${response.status} writing ${fileName}`);
  }
  return data.content.sha;
};

const deleteWorkflow = async (fileName, commitMessage, sha) => {
  assertPat();
  return fetch(`${CONTENTS_API}/${fileName}`, {
    method: 'DELETE',
    headers: ghHeaders(),
    body: JSON.stringify({ message: commitMessage, sha, branch: GH_BRANCH })
  });
};

/* ── Dispatch ───────────────────────────────────────────────────────────── */

/**
 * Fire a `workflow_dispatch`.
 *
 * Answers a shape rather than throwing, because both callers record the
 * outcome to run history either way — a thrown error there would be recorded
 * as a generic server fault and lose the GitHub detail.
 *
 * @returns {Promise<{ok: boolean, status: number|null, detail: string, date: Date}>}
 */
const RETRY_DELAY_MS = 5000;

/* A dropped connection or a GitHub 5xx says nothing about whether the request
   was valid, and the next scheduled attempt is a day away. A 401 or a 404 is a
   standing fact about the token or the file, and retrying it just fails twice. */
const isTransient = (status) => status === null || status === 429 || (status >= 500 && status <= 599);

const dispatchWorkflow = async (workflowFile, inputs, attempt = 1) => {
  if (!hasPat()) {
    return { ok: false, status: null, detail: new MissingPatError().message, date: new Date() };
  }

  const retryOnce = async (outcome) => {
    if (attempt > 1 || !isTransient(outcome.status)) return outcome;
    console.warn(`[GitHub] ${workflowFile} dispatch failed (${outcome.detail}). Retrying once in ${RETRY_DELAY_MS / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    const second = await dispatchWorkflow(workflowFile, inputs, 2);
    if (!second.ok) second.detail = `${second.detail} (retried once)`;
    else console.log(`[GitHub] ${workflowFile} dispatch succeeded on retry.`);
    return second;
  };

  try {
    const response = await fetch(`${API_ROOT}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({ ref: GH_BRANCH, inputs })
    });

    // GitHub's own clock, off the 204's header, so a later run lookup needs no
    // allowance for skew between this host and theirs.
    const stamped = new Date(response.headers.get('date') || Date.now());
    const date = Number.isNaN(stamped.getTime()) ? new Date() : stamped;

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      let detail = `GitHub returned ${response.status}: ${raw.slice(0, 240)}`;
      // The two failures an admin can actually fix, named plainly.
      if (response.status === 401) {
        detail = 'GitHub rejected the token (401). GITHUB_PAT is set but invalid or expired.';
      } else if (response.status === 404) {
        detail =
          `GitHub returned 404 for workflow "${workflowFile}". Either the file is not on ` +
          `${GH_OWNER}/${GH_REPO}@${GH_BRANCH}, or the token lacks the "workflow" scope.`;
      }
      return retryOnce({ ok: false, status: response.status, detail, date });
    }

    return { ok: true, status: response.status, detail: 'Dispatched', date };
  } catch (error) {
    return retryOnce({ ok: false, status: null, detail: error.message, date: new Date() });
  }
};

/* ── Health ─────────────────────────────────────────────────────────────── */

/**
 * Everything the Automation Hub needs from GitHub, probed in order and
 * reported as plain facts. Each check stops the ones that depend on it, so a
 * missing token reads as one problem rather than five.
 */
const probe = async () => {
  const result = {
    owner: GH_OWNER,
    repo: GH_REPO,
    branch: GH_BRANCH,
    tokenPresent: hasPat(),
    tokenValid: null,
    tokenScopes: null,
    canPush: null,
    canReadActions: null,
    rateLimitRemaining: null,
    workflowFiles: null,
    problems: []
  };

  if (!result.tokenPresent) {
    result.problems.push(
      'GITHUB_PAT is not set in the backend environment. Nothing in the Automation Hub can ' +
      'create, edit, delete or dispatch a schedule until it is.'
    );
    return result;
  }

  const call = (url) => fetch(url, { headers: ghHeaders(), signal: AbortSignal.timeout(8000) });

  try {
    const who = await call('https://api.github.com/user');
    result.tokenValid = who.ok;
    result.rateLimitRemaining = who.headers.get('x-ratelimit-remaining');
    // Classic PATs report their scopes on any authenticated response;
    // fine-grained tokens send nothing, so null means "cannot tell".
    result.tokenScopes = who.headers.get('x-oauth-scopes');

    if (!who.ok) {
      result.problems.push(`GITHUB_PAT is set but GitHub rejected it (${who.status}) — expired or revoked.`);
      return result;
    }

    if (result.tokenScopes !== null && !/(^|,\s*)workflow(\s*,|$)/.test(result.tokenScopes)) {
      result.problems.push(
        `The token's scopes are "${result.tokenScopes}" — no "workflow" scope. Writing a ` +
        'schedule\'s workflow file will fail with 404 or 403.'
      );
    }

    const repo = await call(API_ROOT);
    if (!repo.ok) {
      result.canPush = false;
      result.problems.push(`The token cannot see ${GH_OWNER}/${GH_REPO} (${repo.status}).`);
      return result;
    }
    const repoData = await repo.json();
    result.canPush = Boolean(repoData.permissions && repoData.permissions.push);
    if (!result.canPush) {
      result.problems.push(`The token has read-only access to ${GH_OWNER}/${GH_REPO} — it cannot write workflow files.`);
    }

    const actions = await call(`${API_ROOT}/actions/workflows?per_page=100`);
    result.canReadActions = actions.ok;
    if (actions.ok) {
      const body = await actions.json();
      result.workflowFiles = (body.workflows || [])
        .map(w => (w.path || '').replace('.github/workflows/', ''))
        .filter(Boolean);
    } else {
      result.problems.push(`The token cannot read Actions on the repo (${actions.status}); run links will stay unresolved.`);
    }
  } catch (error) {
    result.problems.push(`Could not reach the GitHub API: ${error.message}`);
  }

  return result;
};

module.exports = {
  GH_OWNER,
  GH_REPO,
  GH_BRANCH,
  API_ROOT,
  CONTENTS_API,
  MissingPatError,
  hasPat,
  assertPat,
  ghHeaders,
  getWorkflowSha,
  putWorkflow,
  deleteWorkflow,
  dispatchWorkflow,
  probe
};
