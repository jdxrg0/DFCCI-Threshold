/* The workflow behind "auto-dispatch the code" in the weekly-code panel.
 *
 * Unlike a schedule's workflow, nothing ever created this one: the dispatcher
 * had always posted to send-weekly-code.yml, but that file was never written
 * to the bot repository, so every weekly-code dispatch 404'd into a console
 * line. It is provisioned here, on demand, the same way schedules are.
 *
 * It runs the bot's existing index.js rather than a script of its own — that
 * script already posts CHAT_MESSAGE to CHAT_URL, which is exactly this job.
 * Both values arrive as dispatch inputs because the target chat is editable
 * from the settings panel and must not be baked into the file.
 */

const github = require('./github');

const WEEKLY_CODE_WORKFLOW = 'send-weekly-code.yml';

const WEEKLY_CODE_YAML = `name: "Weekly Code Broadcast"

on:
  workflow_dispatch:
    inputs:
      target_url:
        description: 'The chat to post the weekly code to'
        required: true
        default: ''
      message:
        description: 'The resolved message, code already substituted'
        required: true
        default: ''

jobs:
  send-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - name: Execute Script
        env:
          FACEBOOK_COOKIES: \${{ secrets.FACEBOOK_COOKIES }}
          PROXY_SERVER: \${{ secrets.PROXY_SERVER }}
          PROXY_USERNAME: \${{ secrets.PROXY_USERNAME }}
          PROXY_PASSWORD: \${{ secrets.PROXY_PASSWORD }}
          CHAT_URL: \${{ github.event.inputs.target_url }}
          CHAT_MESSAGE: |
            \${{ github.event.inputs.message }}
          CHAT_CODE_MESSAGE: ''
          REMINDER_TASKS: '[]'
          FB_E2EE_PIN: \${{ secrets.FB_E2EE_PIN }}
        run: node index.js
      - name: Upload Debug Screenshot
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: debug-screenshot-weekly-code
          path: debug.png
          retention-days: 1
`;

/* A workflow file GitHub has never seen cannot be dispatched — the POST 404s
   and reads exactly like a missing token. Checking costs one request and only
   happens on the weekly-code path, which fires at most once a week. */
let knownPresent = false;

/**
 * Make sure the weekly-code workflow exists before something dispatches it.
 *
 * @returns {Promise<{ok: boolean, created: boolean, detail: string}>}
 */
const ensureWeeklyCodeWorkflow = async () => {
  if (knownPresent) return { ok: true, created: false, detail: 'Already present' };

  try {
    const sha = await github.getWorkflowSha(WEEKLY_CODE_WORKFLOW);
    if (sha) {
      knownPresent = true;
      return { ok: true, created: false, detail: 'Already present' };
    }

    await github.putWorkflow(
      WEEKLY_CODE_WORKFLOW,
      WEEKLY_CODE_YAML,
      'Add weekly code broadcast workflow'
    );
    knownPresent = true;
    console.log(`[Scheduler] Created ${WEEKLY_CODE_WORKFLOW} on the bot repository.`);

    // GitHub does not register a brand-new workflow's dispatch endpoint the
    // instant the commit lands, so the very first dispatch after creating it
    // can still 404. Say so rather than letting the caller call it a failure.
    return { ok: true, created: true, detail: 'Created just now' };
  } catch (error) {
    return { ok: false, created: false, detail: error.message };
  }
};

module.exports = { WEEKLY_CODE_WORKFLOW, WEEKLY_CODE_YAML, ensureWeeklyCodeWorkflow };
