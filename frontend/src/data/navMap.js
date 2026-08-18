/* ──────────────────────────────────────────────────────────────────────────
   Route hierarchy — the single source of truth for "where does Back go?"

   Every module page in the app gets the same back control (see
   components/BackBar.jsx), and this file is the only place that decides
   where it lands. When a new route is added to App.jsx, add it here too:

     • Add the pattern + parent to ROUTE_PARENTS (most specific first), or
     • Add it to NO_BACK_ROUTES if it is a top-level / auth screen.

   A route that is missing from both still gets a back button — it just
   falls back to /dashboard — so forgetting an entry degrades gracefully
   instead of making the button disappear.
   ────────────────────────────────────────────────────────────────────────── */
import { matchPath } from 'react-router-dom';

// Screens that are the top of a stack, or sit outside the signed-in shell.
// These never show a back control.
export const NO_BACK_ROUTES = [
  '/',
  '/dashboard',
  '/login',
  '/signup',
  '/forgot-password',
  '/force-logout',
];

// Fallback used when a route has no explicit parent below.
export const DEFAULT_PARENT = '/dashboard';

// Ordered most-specific first. `parent` is used when there is no in-app
// history to pop — i.e. deep links, refreshes, and new tabs.
export const ROUTE_PARENTS = [
  // ── Gentle Mirror ──
  { path: '/mirror/dashboard', parent: '/dashboard' },
  { path: '/mirror/send', parent: '/mirror/dashboard' },
  { path: '/mirror/thread/:id', parent: '/mirror/dashboard' },

  // ── Shining Light (Affirmations) ──
  { path: '/affirm/dashboard', parent: '/dashboard' },
  { path: '/affirm/send', parent: '/affirm/dashboard' },
  { path: '/affirm/:id', parent: '/affirm/dashboard' },

  // ── System Requests (Tickets) ──
  { path: '/tickets/dashboard', parent: '/dashboard' },
  { path: '/tickets/create', parent: '/tickets/dashboard' },
  { path: '/tickets/:id', parent: '/tickets/dashboard' },

  // ── Threshold Games ──
  { path: '/games', parent: '/dashboard' },
  { path: '/games/play/:id', parent: '/games' },
  { path: '/games/create', parent: '/games' },
  { path: '/games/edit/:id', parent: '/games' },

  // ── Devotional Tracker ──
  { path: '/devotionals', parent: '/dashboard' },
  { path: '/devotionals/submit', parent: '/devotionals' },
  { path: '/devotionals/:id', parent: '/devotionals' },

  // ── Resource Center ──
  { path: '/resources', parent: '/dashboard' },
  { path: '/resources/:id', parent: '/resources' },

  // ── Fund Tracker ──
  { path: '/funds', parent: '/dashboard' },

  // ── Admin / Automation ──
  { path: '/admin', parent: '/dashboard' },
  { path: '/admin/automation', parent: '/dashboard' },
  { path: '/automation-hub/calendar', parent: '/admin/automation' },
  { path: '/counselor', parent: '/dashboard' },

  // ── Account & docs ──
  { path: '/settings', parent: '/dashboard' },
  { path: '/docs/:moduleName', parent: '/dashboard' },
];

// Strip a trailing slash so '/games/' and '/games' resolve identically.
const normalize = (pathname) =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

/**
 * Resolve the back target for a pathname.
 * Returns `null` when the route should not show a back control at all.
 */
export const resolveBackTarget = (pathname) => {
  const path = normalize(pathname || '/');

  if (NO_BACK_ROUTES.includes(path)) return null;

  const entry = ROUTE_PARENTS.find(r => matchPath({ path: r.path, end: true }, path));
  return entry ? entry.parent : DEFAULT_PARENT;
};
