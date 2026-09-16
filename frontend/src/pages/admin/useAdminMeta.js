/* ── Admin — the shared attention/meta slice ─────────────────────────────
   Owns the lists every panel's badge counts plus the boot-fed ones the tabs
   render straight from props: pending signups, deletion/restore/archive,
   system requests, the member stats for the Overview KPI and the unfiltered
   email total.

   Everything here loads in parallel at boot so the badges and the Overview
   are correct on first paint. Tabs that page/filter server-side (members,
   emails, audit, limits) keep their own fetch state; this hook only borrows
   their whole-collection figures. `refreshAll()` bumps `refreshKey` so those
   self-managed tabs re-query when mounted, while the shared lists refetch
   directly. */

import { useCallback, useRef, useState } from 'react';
import api from '../../api';
import * as users from '../../services/users';
import * as emailsApi from '../../services/emails';
import { EMPTY_USER_STATS, EMAILS_PER_PAGE, USERS_PER_PAGE } from './utils';

export const useAdminMeta = () => {
  const [signups, setSignups] = useState([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [restoreRequests, setRestoreRequests] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);
  const [ticketsList, setTicketsList] = useState([]);
  const [userStats, setUserStats] = useState(EMPTY_USER_STATS);
  const [emailsLoggedAll, setEmailsLoggedAll] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bootedRef = useRef(false);

  // Each fetcher owns one slice and reports its own failure to the single
  // banner. A dead endpoint reads as an error, not as an empty list.
  const load = useCallback(async (path, setter, label) => {
    try {
      const res = await api.get(path);
      setter(res.data);
      setError('');
      return res.data;
    } catch (err) {
      setError(`Could not load ${label}. ${err.response?.data?.message || err.message || ''}`.trim());
      return null;
    }
  }, []);

  const fetchDeletionRequests = useCallback(
    () => load('/threads/admin/deletion-requests', setDeletionRequests, 'deletion requests'), [load]);
  const fetchRestoreRequests = useCallback(
    () => load('/threads/admin/restore-requests', setRestoreRequests, 'restore requests'), [load]);
  const fetchRecentlyDeleted = useCallback(
    () => load('/threads/admin/recently-deleted', setRecentlyDeleted, 'the deletion archive'), [load]);
  const fetchTickets = useCallback(() => load('/tickets', setTicketsList, 'system requests'), [load]);

  const fetchSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const data = await users.getPendingSignups();
      setSignups(data.signups || []);
      setError('');
    } catch (err) {
      setError(`Could not load pending signups. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setSignupsLoading(false);
    }
  }, []);

  // Members page their own list, but the Overview KPI reads whole-collection
  // figures — fetched here with the default filters (page 1, all roles).
  const fetchUserStats = useCallback(async () => {
    try {
      const data = await users.listUsers({ page: 1, limit: USERS_PER_PAGE });
      setUserStats(data.stats || EMPTY_USER_STATS);
      setError('');
    } catch (err) {
      setError(`Could not load members. ${err.response?.data?.message || err.message || ''}`.trim());
    }
  }, []);

  // Unfiltered total for the Overview tile, so filtering the log does not make
  // the headline number jump around. The log tab keeps its own page.
  const fetchEmailsTotal = useCallback(async () => {
    try {
      const data = await emailsApi.listEmails({ page: 1, limit: EMAILS_PER_PAGE });
      setEmailsLoggedAll(data.totalCount || 0);
      setError('');
    } catch (err) {
      setError(`Could not load the email log. ${err.response?.data?.message || err.message || ''}`.trim());
    }
  }, []);

  const runAll = useCallback(async () => {
    await Promise.allSettled([
      fetchUserStats(), fetchSignups(), fetchDeletionRequests(), fetchRestoreRequests(),
      fetchRecentlyDeleted(), fetchTickets(), fetchEmailsTotal(),
    ]);
  }, [fetchUserStats, fetchSignups, fetchDeletionRequests, fetchRestoreRequests,
      fetchRecentlyDeleted, fetchTickets, fetchEmailsTotal]);

  // Boot is idempotent: the shell's auth effect can re-run without double-loading.
  const boot = useCallback(async () => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    setLoading(true);
    await runAll();
    setLastSync(Date.now());
    setLoading(false);
  }, [runAll]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await runAll();
    // Self-managed tabs re-query on this bump; the shared lists above already did.
    setRefreshKey((k) => k + 1);
    setLastSync(Date.now());
    setRefreshing(false);
  }, [runAll]);

  const reportError = useCallback((msg) => { if (msg) setError(msg); }, []);

  return {
    signups, signupsLoading,
    deletionRequests, restoreRequests, recentlyDeleted,
    ticketsList, userStats, emailsLoggedAll,
    loading, refreshing, error, lastSync, refreshKey,
    ready: !loading,
    boot, refreshAll,
    fetchSignups, fetchDeletionRequests, fetchRestoreRequests,
    fetchRecentlyDeleted, fetchTickets, fetchUserStats, fetchEmailsTotal,
    recordEmailsTotal: setEmailsLoggedAll,
    recordUserStats: setUserStats,
    reportError,
    setError,
  };
};