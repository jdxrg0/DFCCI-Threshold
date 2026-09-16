/* ── Admin — Members ─────────────────────────────────────────────────────
   The roster: server-paged, -searched, -filtered and -sorted, plus the bulk
   bar, single-row mutations, CSV export and role/date-power controls. Self-
   managed state — the shell only feeds the session user, its `refreshKey`
   (so the global Refresh button re-runs the query) and the whole-collection
   stats for the Overview KPI. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as users from '../../services/users';
import { useLanguage } from '../../context/LanguageContext';
import { renderAvatarHelper } from '../../utils/avatarHelper';
import { EmptyState, Pager, Skeletons } from './shared';
import {
  BULK_ROLES, CSV_MAX_PAGES, CSV_PAGE_SIZE, EMPTY_USER_STATS,
  USERS_PER_PAGE, hoursUntil, makeMutate, memberCount, shortDate,
} from './utils';
import {
  Bell,
  BellOff,
  CheckCircle,
  Download,
  KeyRound,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
  Zap,
} from 'lucide-react';

const MembersTab = ({
  user, refreshKey, initialStatus = '', onStatusConsumed,
  onUserStats, onError, confirm, alert, prompt,
}) => {
  const { t } = useLanguage();

  const [userQuery, setUserQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState(() => initialStatus || '');
  const [userSort, setUserSort] = useState('name');
  const [usersList, setUsersList] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotalCount, setUsersTotalCount] = useState(0);
  const [userStats, setUserStats] = useState(EMPTY_USER_STATS);
  const [usersLoading, setUsersLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [otpUserId, setOtpUserId] = useState(null);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectAllRef = useRef(null);

  const mutate = makeMutate(alert);

  // The Overview "Verified" tile seeds this filter on arrival. Once consumed
  // the shell clears the seed so a later plain visit lands on "all".
  useEffect(() => {
    onStatusConsumed();
  }, [onStatusConsumed]);

  /* ── Fetching ───────────────────────────────────────────────────────── */

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await users.listUsers({
        page: usersPage, limit: USERS_PER_PAGE, search: userQuery,
        role: userRole, status: userStatus, sort: userSort,
      });
      const pages = data.totalPages || 1;
      setUsersList(data.users || []);
      setUsersTotalPages(pages);
      setUsersTotalCount(data.totalCount || 0);
      // Deleting the last row of the last page leaves the admin standing on a
      // page that no longer exists; walk back rather than claim nothing matches.
      if (usersPage > pages) setUsersPage(pages);
      // Whole-collection figures, reported up for the Overview KPI.
      const stats = data.stats || EMPTY_USER_STATS;
      setUserStats(stats);
      onUserStats(stats);
      onError('');
    } catch (err) {
      onError(`Could not load members. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, userQuery, userRole, userStatus, userSort, onUserStats, onError]);

  // The same 280ms debounce the old page used for the search box; the selects
  // and the pager just run it again too. `refreshKey` lets the global Refresh
  // button re-run the query with the current filters.
  useEffect(() => {
    const id = setTimeout(fetchUsers, 280);
    return () => clearTimeout(id);
  }, [fetchUsers, refreshKey]);

  /* ── Selection ──────────────────────────────────────────────────────── */

  // The server refuses to bulk-target the caller, so their row is never offered
  // as a checkbox and never lands in the selection.
  const selectableIds = useMemo(
    () => usersList.filter((u) => u._id !== user?._id).map((u) => u._id),
    [usersList, user],
  );

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const clearSelection = () => setSelectedIds((prev) => (prev.size ? new Set() : prev));

  // `indeterminate` is a DOM property with no HTML attribute behind it, so the
  // partial-selection state on the header box can only be set imperatively.
  useEffect(() => {
    const box = selectAllRef.current;
    if (!box) return;
    const chosen = selectableIds.filter((id) => selectedIds.has(id)).length;
    box.indeterminate = chosen > 0 && chosen < selectableIds.length;
  }, [selectedIds, selectableIds]);

  const toggleOne = useCallback((id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), []);

  const toggleSelectPage = () => setSelectedIds((prev) => {
    const every = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
    const next = new Set(prev);
    selectableIds.forEach((id) => (every ? next.delete(id) : next.add(id)));
    return next;
  });

  // Any change to the result set sends the pager home and drops the selection —
  // a ticked id the admin can no longer see is an action they cannot review.
  const setUserFilter = (setter) => (value) => {
    setter(value);
    setUsersPage(1);
    clearSelection();
  };

  const goUsersPage = (page) => { setUsersPage(page); clearSelection(); };

  /* ── Mutations ──────────────────────────────────────────────────────── */

  // Role changes are irreversible from the member's side and ADMIN grants full
  // platform control, so both now confirm instead of firing on change.
  const handleRoleChange = (target, newRole) => {
    if (target._id === user._id) {
      alert('Not allowed', 'You cannot change your own role.');
      return;
    }
    if (newRole === target.role) return;

    const warning = newRole === 'ADMIN'
      ? '\n\nAdministrators can manage every member, approve deletions and read the platform logs.'
      : '';
    confirm(
      'Change role',
      `Change ${target.displayName} from ${t(`role_${target.role.toLowerCase()}`)} to ${t(`role_${newRole.toLowerCase()}`)}?${warning}`,
      () => mutate(() => users.setUserRole(target._id, newRole), fetchUsers, 'Failed to update role'),
    );
  };

  const handleToggleReminders = (id) =>
    mutate(() => users.toggleReminders(id), fetchUsers, 'Failed to toggle reminders');

  const handleRequestNameChange = (id) =>
    mutate(() => users.requestNameChange(id), fetchUsers, 'Failed to request name change');

  // Unverifying locks the member out until they redeem a fresh code, so only
  // that direction confirms; granting verification is recoverable in one click.
  const handleToggleVerify = (target) => {
    const next = !target.isVerified;

    const run = async () => {
      setVerifyingId(target._id);
      try {
        const data = await users.verifyUser(target._id, { isVerified: next });
        await fetchUsers();
        alert('Done', data.message);
      } catch (err) {
        alert('Error', err.response?.data?.message || 'Failed to update verification');
      } finally {
        setVerifyingId(null);
      }
    };

    if (next) {
      run();
      return;
    }
    confirm(
      'Remove verification',
      `Unverify ${target.displayName}? They will be locked out until they enter a new code.`,
      run,
    );
  };

  const handleResendOtp = async (target) => {
    setOtpUserId(target._id);
    try {
      const data = await users.resendUserOtp(target._id);
      alert('Code sent', data.message);
    } catch (err) {
      alert('Error', err.response?.data?.message || 'Failed to resend the verification code');
    } finally {
      setOtpUserId(null);
    }
  };

  /* Bulk endpoints all answer with matched/modified/skipped. `skipped` is the
     only way an admin learns that a row was left alone — a stale id, or their
     own. */
  const runBulk = (title, message, request) => {
    confirm(title, message, async () => {
      setBulkBusy(true);
      try {
        const data = await request(Array.from(selectedIds));
        const skipped = data.skipped?.length || 0;
        clearSelection();
        await fetchUsers();
        alert(
          'Bulk action complete',
          skipped
            ? `${data.message}. ${data.modified} changed, ${skipped} skipped.`
            : data.message,
        );
      } catch (err) {
        alert('Error', err.response?.data?.message || 'The bulk action failed');
      } finally {
        setBulkBusy(false);
      }
    });
  };

  const handleBulkRole = (role) => {
    const warning = role === 'ADMIN'
      ? '\n\nAdministrators can manage every member, delete accounts in bulk, approve deletions and read the platform logs. Grant it only to people who should hold all of that.'
      : '';
    runBulk(
      'Set role',
      `Set ${memberCount(selectedIds.size)} to ${t(`role_${role.toLowerCase()}`)}?${warning}`,
      (ids) => users.bulkRoleChange(ids, role),
    );
  };

  const handleBulkReminders = (subscribed) =>
    runBulk(
      subscribed ? 'Enable dues reminders' : 'Disable dues reminders',
      `${subscribed ? 'Enable' : 'Disable'} dues reminder emails for ${memberCount(selectedIds.size)}?`,
      (ids) => users.bulkToggleReminders(ids, subscribed),
    );

  const handleBulkVerify = (isVerified) =>
    runBulk(
      isVerified ? 'Verify members' : 'Unverify members',
      isVerified
        ? `Mark ${memberCount(selectedIds.size)} as verified? They will be able to sign in without a code.`
        : `Remove verification from ${memberCount(selectedIds.size)}? They will be locked out until they enter a new code.`,
      (ids) => users.bulkVerify(ids, isVerified),
    );

  const handleBulkDelete = () =>
    runBulk(
      'Delete members',
      `Permanently delete ${memberCount(selectedIds.size)}? Their accounts, profiles and access are removed immediately. This cannot be undone.`,
      (ids) => users.bulkDelete(ids),
    );

  const handleDeleteUser = (target) => {
    confirm(
      'Delete member',
      `Permanently delete ${target.displayName} (${target.email})? Their account and access are removed immediately. This cannot be undone.`,
      () => mutate(() => users.deleteUser(target._id), fetchUsers, 'Failed to delete user'),
    );
  };

  const handleDatePower = (target) => {
    const remaining = hoursUntil(target.customDatePowerExpires);
    const prefix = remaining
      ? `${target.displayName} currently has custom date power (~${remaining}h remaining).\n\n`
      : '';
    prompt(
      'Custom date power',
      `${prefix}Enter a duration in hours (e.g. 1, 2, 24). Enter 0 to revoke.`,
      async (val) => {
        if (val === null || val === undefined || String(val).trim() === '') return;
        const num = parseFloat(val);
        if (Number.isNaN(num) || num < 0) {
          alert('Error', 'Please enter a valid positive number, or 0 to revoke.');
          return;
        }
        try {
          const data = await users.setCustomDatePower(target._id, {
            durationMinutes: Math.round(num * 60),
          });
          alert('Success', data.message);
          fetchUsers();
        } catch (err) {
          alert('Error', err.response?.data?.message || 'Failed to update custom date power');
        }
      },
    );
  };

  /* ── Shared fragments (one source for table row + mobile card) ──────── */

  const identityOf = (u, size) => (
    <div className="adm-ident">
      {renderAvatarHelper(u, size, { flexShrink: 0 })}
      <div className="adm-ident__text">
        <span className="adm-ident__name">{u.displayName}</span>
        <span className="adm-ident__mail">{u.email}</span>
      </div>
    </div>
  );

  const permissionsOf = (u) => {
    const isSelf = u._id === user._id;
    const powerHours = hoursUntil(u.customDatePowerExpires);
    // The server 400s a resend for a verified member with no pending email
    // change, so the button only exists where a code is actually outstanding.
    const canResend = !u.isVerified || !!u.pendingEmail;
    const verifying = verifyingId === u._id;
    const sendingOtp = otpUserId === u._id;

    return (
      <div className="adm-pills">
        <button
          type="button"
          className="adm-pill"
          data-tone={u.isVerified ? 'danger' : 'ok'}
          disabled={isSelf || verifying}
          onClick={() => handleToggleVerify(u)}
          title={isSelf
            ? 'You cannot change your own verification'
            : (u.isVerified ? `Remove verification from ${u.displayName}` : `Verify ${u.displayName}`)}
        >
          {verifying
            ? <RefreshCw size={12} className="adm-spin" />
            : (u.isVerified ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />)}
          {u.isVerified ? 'Unverify' : 'Verify'}
        </button>

        {canResend && (
          <button
            type="button"
            className="adm-pill"
            data-tone="info"
            disabled={sendingOtp}
            onClick={() => handleResendOtp(u)}
            title={`Email a fresh verification code to ${u.pendingEmail || u.email}`}
          >
            {sendingOtp ? <RefreshCw size={12} className="adm-spin" /> : <KeyRound size={12} />}
            {sendingOtp ? 'Sending' : 'Resend OTP'}
          </button>
        )}

        {!u.isVerified && <span className="adm-self">Awaiting verification</span>}

        {u.isVerified && (
          <>
            <button
              type="button"
              className="adm-pill"
              data-tone="ok"
              aria-pressed={!!u.subscribedToDuesReminders}
              onClick={() => handleToggleReminders(u._id)}
              title={u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled')}
            >
              {u.subscribedToDuesReminders ? <Bell size={12} /> : <BellOff size={12} />}
              {u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled')}
            </button>

            <button
              type="button"
              className="adm-pill"
              data-tone="warn"
              aria-pressed={!!u.nameChangeRequested}
              onClick={() => handleRequestNameChange(u._id)}
              title={u.nameChangeRequested ? 'A rename is already pending' : 'Ask this member to update their name'}
            >
              <UserCog size={12} />
              {u.nameChangeRequested ? 'Rename pending' : 'Rename'}
            </button>

            <button
              type="button"
              className="adm-pill"
              data-tone="violet"
              aria-pressed={powerHours > 0}
              onClick={() => handleDatePower(u)}
              title="Let this member backdate entries for a limited window"
            >
              <Zap size={12} />
              {powerHours > 0 ? `Date power ${powerHours}h` : 'Date power'}
            </button>
          </>
        )}
      </div>
    );
  };

  const roleSelectOf = (u) => (
    <select
      className="adm-field adm-field--auto"
      value={u.role}
      onChange={(e) => handleRoleChange(u, e.target.value)}
      aria-label={`Role for ${u.displayName}`}
    >
      <option value="MEMBER">{t('role_member')}</option>
      <option value="COUNSELOR">{t('role_counselor')}</option>
      <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
      <option value="ADMIN">{t('role_admin')}</option>
    </select>
  );

  const verifyChip = (u) => (
    <span className="adm-chip" data-tone={u.isVerified ? 'ok' : 'warn'}>
      {u.isVerified ? <CheckCircle size={11} /> : <ShieldAlert size={11} />}
      {u.isVerified ? 'Verified' : 'Unverified'}
    </span>
  );

  const roleChip = (u) => (
    <span className="adm-chip adm-chip--sq" data-role={u.role}>
      {t(`role_${(u.role || 'member').toLowerCase()}`)}
    </span>
  );

  /* ── CSV export ─────────────────────────────────────────────────────── */

  // "Export CSV" has to mean everything matching the current filters, not the
  // twelve rows on screen, so it walks the same endpoint page by page first.
  const exportUsersCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= CSV_MAX_PAGES) {
        const data = await users.listUsers({
          page, limit: CSV_PAGE_SIZE, search: userQuery,
          role: userRole, status: userStatus, sort: userSort,
        });
        all.push(...(data.users || []));
        totalPages = data.totalPages || 1;
        page += 1;
      }

      // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
      const safe = (value) => {
        const str = String(value ?? '');
        const escaped = /^[=+\-@]/.test(str) ? `'${str}` : str;
        return `"${escaped.replace(/"/g, '""')}"`;
      };
      const header = ['Name', 'Email', 'Role', 'Verified', 'Dues reminders', 'Rename requested', 'Joined'];
      const rows = all.map((u) => [
        u.displayName, u.email, u.role,
        u.isVerified ? 'Yes' : 'No',
        u.subscribedToDuesReminders ? 'Yes' : 'No',
        u.nameChangeRequested ? 'Yes' : 'No',
        u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
      ]);
      const csv = [header, ...rows].map((r) => r.map(safe).join(',')).join('\r\n');
      // BOM so Excel opens the UTF-8 names correctly.
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `dfcci-members-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error', err.response?.data?.message || 'Could not export the member list.');
    } finally {
      setExporting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  const selected = selectedIds.size;
  const bulkOff = bulkBusy || selected === 0;

  // No checkbox on the current admin's row: the server refuses to bulk-target
  // the caller, so offering one would be a lie. The spacer holds the column open.
  const checkboxOf = (u) => (u._id === user._id
    ? <span className="adm-check-gap" aria-hidden="true" />
    : (
      <input
        type="checkbox"
        className="adm-check"
        checked={selectedIds.has(u._id)}
        onChange={() => toggleOne(u._id)}
        aria-label={`Select ${u.displayName}`}
      />
    ));

  return (
    <>
      <div className="adm-toolbar">
        <div className="adm-search">
          <Search size={15} className="adm-search__icon" aria-hidden="true" />
          <input
            className="adm-field"
            type="search"
            value={userQuery}
            onChange={(e) => setUserFilter(setUserQuery)(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search members"
          />
          {userQuery && (
            <button type="button" className="adm-search__clear" onClick={() => setUserFilter(setUserQuery)('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <select className="adm-field adm-field--auto" value={userRole} onChange={(e) => setUserFilter(setUserRole)(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="ADMIN">{t('role_admin')}</option>
          <option value="COUNSELOR">{t('role_counselor')}</option>
          <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
          <option value="MEMBER">{t('role_member')}</option>
        </select>

        <select className="adm-field adm-field--auto" value={userStatus} onChange={(e) => setUserFilter(setUserStatus)(e.target.value)} aria-label="Filter by verification">
          <option value="">Any status</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>

        <select className="adm-field adm-field--auto" value={userSort} onChange={(e) => setUserFilter(setUserSort)(e.target.value)} aria-label="Sort members">
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="role">By role</option>
        </select>

        {/* With rows ticked the meta area gives way to the bulk bar: the count
            and the CSV button describe the filter, which is not what is being
            acted on. */}
        {selected > 0 ? (
          <div className="adm-bulk" role="group" aria-label="Actions for the selected members">
            <span className="adm-bulk__count">
              {bulkBusy && <RefreshCw size={12} className="adm-spin" aria-hidden="true" />}
              {selected} selected
            </span>

            <select
              className="adm-field adm-field--auto"
              value=""
              disabled={bulkOff}
              onChange={(e) => { if (e.target.value) handleBulkRole(e.target.value); }}
              aria-label="Set the role of every selected member"
            >
              <option value="">Set role…</option>
              {BULK_ROLES.map((role) => (
                <option key={role} value={role}>{t(`role_${role.toLowerCase()}`)}</option>
              ))}
            </select>

            <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkReminders(true)}>
              <Bell size={13} /> Reminders on
            </button>
            <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkReminders(false)}>
              <BellOff size={13} /> Reminders off
            </button>
            <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkVerify(true)}>
              <ShieldCheck size={13} /> Verify
            </button>
            <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkVerify(false)}>
              <ShieldAlert size={13} /> Unverify
            </button>
            <button type="button" className="adm-ghost-btn adm-ghost-btn--danger" disabled={bulkOff} onClick={handleBulkDelete}>
              <Trash2 size={13} /> Delete
            </button>

            <span className="adm-toolbar__spacer" />

            <button type="button" className="adm-ghost-btn" disabled={bulkBusy} onClick={clearSelection}>
              <X size={13} /> Clear
            </button>
          </div>
        ) : (
          <>
            <span className="adm-toolbar__meta">
              {usersLoading
                ? 'Loading…'
                : usersTotalCount === userStats.total
                  ? memberCount(userStats.total)
                  : `${usersTotalCount} of ${userStats.total}`}
            </span>

            <button type="button" className="adm-ghost-btn" onClick={exportUsersCsv} disabled={exporting || !usersTotalCount}>
              {exporting
                ? <RefreshCw size={13} className="adm-spin" aria-hidden="true" />
                : <Download size={13} aria-hidden="true" />}
              {exporting ? 'Exporting' : 'CSV'}
            </button>
          </>
        )}
      </div>

      {usersList.length === 0 ? (
        usersLoading ? <Skeletons count={6} /> : (
          <EmptyState
            icon={Users}
            title="No members match"
            text="Nothing matches the current search and filters. Clear them to see the full roster."
          />
        )
      ) : (
        // Rows are held at reduced opacity while the next page loads. Swapping
        // in skeletons would collapse the table to another height and bounce
        // the page.
        <div className={usersLoading ? 'adm-stale' : undefined} aria-busy={usersLoading || undefined}>
          {/* Desktop table */}
          <div className="adm-table-wrap adm-desk">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col" className="adm-td-check">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="adm-check"
                        checked={allSelected}
                        disabled={!selectableIds.length}
                        onChange={toggleSelectPage}
                        aria-label="Select every member on this page"
                      />
                    </th>
                    <th scope="col">Member</th>
                    <th scope="col">Status</th>
                    <th scope="col">Role</th>
                    <th scope="col">Permissions</th>
                    <th scope="col">Joined</th>
                    <th scope="col" className="adm-td-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u._id}>
                      <td className="adm-td-check">{checkboxOf(u)}</td>
                      <td>{identityOf(u, 38)}</td>
                      <td>{verifyChip(u)}</td>
                      <td>{roleChip(u)}</td>
                      <td>{permissionsOf(u)}</td>
                      <td className="adm-td-dim">{shortDate(u.createdAt)}</td>
                      <td className="adm-td-right">
                        {u._id === user._id ? (
                          <span className="adm-self">Current session</span>
                        ) : (
                          <div className="adm-actions">
                            {roleSelectOf(u)}
                            <button
                              type="button"
                              className="adm-icon-btn"
                              data-tone="danger"
                              onClick={() => handleDeleteUser(u)}
                              aria-label={`Delete ${u.displayName}`}
                              title={`Delete ${u.displayName}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="adm-cards adm-cards--single adm-mob">
            {usersList.map((u) => (
              <div key={u._id} className="adm-card">
                <div className="adm-card__head">
                  {checkboxOf(u)}
                  {identityOf(u, 34)}
                  {roleChip(u)}
                </div>
                <div className="adm-rule" />
                <div className="adm-card__head">
                  {verifyChip(u)}
                  <span className="adm-card__stamp">Joined {shortDate(u.createdAt)}</span>
                </div>
                {permissionsOf(u)}
                {u._id !== user._id && (
                  <div className="adm-card__foot">
                    {roleSelectOf(u)}
                    <button
                      type="button"
                      className="adm-icon-btn"
                      data-tone="danger"
                      onClick={() => handleDeleteUser(u)}
                      aria-label={`Delete ${u.displayName}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Pager
        page={usersPage}
        totalPages={usersTotalPages}
        onChange={goUsersPage}
        label={{ previous: t('previous'), next: t('next'), of: t('page_of')(usersPage, usersTotalPages) }}
      />
    </>
  );
};

export default MembersTab;