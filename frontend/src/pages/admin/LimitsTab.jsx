/* ── Admin — Platform Limits ─────────────────────────────────────────────
   The free-tier resource dashboard: MongoDB Atlas M0, Cloudinary credits,
   the Gmail SMTP relay and the hosting/deployment ceilings. The usage data
   and the growth history are self-managed — the calls are the page's
   expensive ones (Cloudinary is live and dbStats walks every collection),
   so they load once and refresh on request or via the global Refresh. */

import { useCallback, useEffect, useState } from 'react';
import * as users from '../../services/users';
import UsageTrendChart from '../../components/UsageTrendChart';
import { Meter, Skeletons } from './shared';
import { formatBytes, usageTone } from './utils';
import {
  AlertTriangle, Cloud, Cpu, Database, GitBranch, Info, Mail, RefreshCw,
} from 'lucide-react';

const LimitsTab = ({ refreshKey }) => {
  const [limitsData, setLimitsData] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsError, setLimitsError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);

  const fetchPlatformLimits = useCallback(async () => {
    setLimitsLoading(true);
    setLimitsError('');
    try {
      const data = await users.getPlatformLimits();
      setLimitsData(data);
    } catch (err) {
      setLimitsError(err.response?.data?.message || 'Failed to fetch platform limits data.');
    } finally {
      setLimitsLoading(false);
    }
  }, []);

  const fetchPlatformHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await users.getPlatformHistory({ days: historyDays });
      setHistory(data.snapshots || []);
    } catch (err) {
      // The trend chart is supplementary. A failure here must not take the
      // limit cards down with it, so it is logged rather than raised.
      console.error('Failed to load platform history:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDays]);

  // The live calls are deferred a tick so the setStates run outside the effect
  // body (the same shape the growth history below uses).
  useEffect(() => {
    const id = setTimeout(fetchPlatformLimits, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The global Refresh bumps `refreshKey`; re-run both live calls when it does.
  useEffect(() => {
    if (!refreshKey) return;
    const id = setTimeout(fetchPlatformLimits, 0);
    return () => clearTimeout(id);
  }, [refreshKey, fetchPlatformLimits]);

  // The growth chart re-queries whenever its window changes. Deferred a tick so
  // running through the range options fires one request instead of one per step.
  useEffect(() => {
    const id = setTimeout(fetchPlatformHistory, 120);
    return () => clearTimeout(id);
  }, [fetchPlatformHistory, refreshKey]);

  if (limitsLoading && !limitsData) {
    return (
      <>
        <div className="adm-stats" style={{ marginTop: 0, marginBottom: 'var(--sp-4)' }} aria-hidden="true">
          <div className="adm-skel" /><div className="adm-skel" /><div className="adm-skel" />
        </div>
        <Skeletons count={3} />
      </>
    );
  }

  if (limitsError) {
    return (
      <div className="adm-empty">
        <AlertTriangle size={38} className="adm-empty__icon" style={{ color: 'var(--danger)', opacity: 1 }} />
        <h4 className="adm-empty__title">Could not read resource stats</h4>
        <p className="adm-empty__text">{limitsError}</p>
        <button type="button" className="btn btn-primary" style={{ marginTop: '0.6rem' }} onClick={fetchPlatformLimits}>
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  if (!limitsData) return null;

  const { database, emails: emailUsage, cloudinary } = limitsData;
  const mongoLimit = database.limitBytes || 512 * 1024 * 1024;
  const mongoPercent = Math.min(100, Math.max(0.1, (database.dataSize / mongoLimit) * 100));
  const emailLimit = emailUsage.limit || 500;
  const emailPercent = Math.min(100, Math.max(0.1, (emailUsage.sentLast24h / emailLimit) * 100));

  const cloudMeters = [
    cloudinary?.credits && {
      key: 'credits', label: 'Monthly credits',
      text: `${(cloudinary.credits.usage || 0).toFixed(2)} / ${cloudinary.credits.limit || 25}`,
      percent: cloudinary.credits.usedPercent || 0,
    },
    cloudinary?.storage && {
      key: 'storage', label: 'Media storage',
      text: `${formatBytes(cloudinary.storage.usage)} / ${formatBytes(cloudinary.storage.limit)}`,
      percent: cloudinary.storage.usedPercent || 0,
    },
    cloudinary?.transformations && {
      key: 'transforms', label: 'Image transformations',
      text: `${(cloudinary.transformations.usage || 0).toLocaleString()} / ${(cloudinary.transformations.limit || 25000).toLocaleString()}`,
      percent: cloudinary.transformations.usedPercent || 0,
    },
    cloudinary?.bandwidth && {
      key: 'bandwidth', label: 'Delivery bandwidth',
      text: `${formatBytes(cloudinary.bandwidth.usage)} / ${formatBytes(cloudinary.bandwidth.limit)}`,
      percent: cloudinary.bandwidth.usedPercent || 0,
    },
  ].filter(Boolean);

  const headline = [
    {
      key: 'db', icon: Database, tone: 'var(--success)', label: 'Database storage',
      value: formatBytes(database.dataSize), meta: `${mongoPercent.toFixed(2)}% of 512 MB free tier`,
    },
    {
      key: 'cloud', icon: Cloud, tone: 'var(--info)', label: 'Cloudinary credits',
      value: cloudinary?.credits ? `${(cloudinary.credits.usage || 0).toFixed(2)} / ${cloudinary.credits.limit || 25}` : 'N/A',
      meta: cloudinary?.credits ? `${(cloudinary.credits.usedPercent || 0).toFixed(1)}% credit usage` : 'Free plan (25 credits)',
    },
    {
      key: 'mail', icon: Mail, tone: 'var(--tone-violet)', label: 'Daily emails',
      value: `${emailUsage.sentLast24h} / ${emailLimit}`, meta: `${emailPercent.toFixed(1)}% of the 24h cap`,
    },
  ];

  return (
    <div className="adm-limits">
      <div className="adm-toolbar">
        <span className="adm-toolbar__meta">
          Live usage across the free tiers this platform runs on.
        </span>
        <span className="adm-toolbar__spacer" />
        <button type="button" className="adm-ghost-btn" onClick={fetchPlatformLimits} disabled={limitsLoading}>
          <RefreshCw size={13} className={limitsLoading ? 'adm-spin' : undefined} /> Refresh stats
        </button>
      </div>

      <div className="adm-stats" style={{ marginTop: 0 }}>
        {headline.map(({ key, icon: Icon, tone, label, value, meta }) => (
          <div key={key} className="adm-stat adm-stat--static" style={{ '--tone': tone }}>
            <span className="adm-stat__icon"><Icon size={19} /></span>
            <span className="adm-stat__text">
              <span className="adm-stat__value">{value}</span>
              <span className="adm-stat__label">{label}</span>
              <span className="adm-card__stamp" style={{ marginTop: '0.15rem' }}>{meta}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Written by components/UsageTrendChart.jsx against this exact prop set. */}
      <UsageTrendChart
        snapshots={history}
        loading={historyLoading}
        days={historyDays}
        onDaysChange={setHistoryDays}
      />

      <div className="adm-limit-grid">
        {/* MongoDB */}
        <section className="adm-limit-card" data-tone="ok">
          <div className="adm-limit-head">
            <h4 className="adm-limit-head__name"><Database size={17} /> MongoDB Atlas (M0)</h4>
            <span className="adm-chip" data-tone="ok">Database</span>
          </div>
          <p className="adm-fine">
            The shared M0 cluster caps out at <strong>512 MB</strong>. Passing it locks writes, which
            blocks signups, threads and transactions.
          </p>
          <div className="adm-meter">
            <div className="adm-meter__row">
              <span className="adm-meter__label">Storage consumption</span>
              <span className="adm-meter__value" data-tone={mongoPercent > 80 ? 'danger' : undefined}>
                {formatBytes(database.dataSize)} / 512 MB
              </span>
            </div>
            <Meter percent={mongoPercent} tone={usageTone(mongoPercent)} />
            <div className="adm-meter__foot">
              <span>Logical {formatBytes(database.dataSize)}</span>
              <span>Allocated {formatBytes(database.storageSize)}</span>
            </div>
          </div>
          <div>
            <div className="adm-subhead">
              <span>Collections</span>
              <span>{database.collections.length}</span>
            </div>
            <div className="adm-mini-scroll" style={{ marginTop: '0.4rem' }}>
              <table className="adm-mini">
                <thead>
                  <tr><th scope="col">Collection</th><th scope="col">Docs</th><th scope="col">Size</th></tr>
                </thead>
                <tbody>
                  {database.collections.map((col) => (
                    <tr key={col.name}>
                      <td>{col.name}</td>
                      <td>{col.count}</td>
                      <td>{col.size > 0 ? formatBytes(col.size) : '< 1 KB'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Cloudinary */}
        <section className="adm-limit-card" data-tone="info">
          <div className="adm-limit-head">
            <h4 className="adm-limit-head__name"><Cloud size={17} /> Cloudinary media</h4>
            <span className="adm-chip" data-tone="info">Media</span>
          </div>
          <p className="adm-fine">
            Hosts profile pictures and resource covers. The free tier gives <strong>25 monthly credits</strong> —
            1 credit is 1 GB of storage, 1 GB of bandwidth, or 1,000 transformations.
          </p>
          {cloudMeters.length ? (
            <>
              {cloudMeters.map(({ key, label, text, percent }) => (
                <div key={key} className="adm-meter">
                  <div className="adm-meter__row">
                    <span className="adm-meter__label">{label}</span>
                    <span className="adm-meter__value">{text}</span>
                  </div>
                  <Meter percent={percent} tone={usageTone(percent)} />
                </div>
              ))}
              <span className="adm-card__stamp" style={{ textAlign: 'right' }}>
                Plan: {cloudinary.plan} · live stats
              </span>
            </>
          ) : (
            <div className="adm-note" data-tone="info">
              <Info size={14} />
              <span>Live usage is unavailable right now. Assume the standard free tier (25 credits per month).</span>
            </div>
          )}
        </section>

        {/* Gmail SMTP */}
        <section className="adm-limit-card" data-tone="violet">
          <div className="adm-limit-head">
            <h4 className="adm-limit-head__name"><Mail size={17} /> Gmail outgoing SMTP</h4>
            <span className="adm-chip" data-tone="violet">Email</span>
          </div>
          <p className="adm-fine">
            Youth notices, verification OTPs and dues reminders all leave through SMTP. The free Gmail
            relay stops at <strong>500 emails a day</strong>.
          </p>
          <div className="adm-meter">
            <div className="adm-meter__row">
              <span className="adm-meter__label">Sent in the last 24 hours</span>
              <span className="adm-meter__value" data-tone={emailPercent > 80 ? 'danger' : undefined}>
                {emailUsage.sentLast24h} / {emailLimit}
              </span>
            </div>
            <Meter percent={emailPercent} tone={usageTone(emailPercent)} />
            <div className="adm-meter__foot">
              <span>{Math.max(0, emailLimit - emailUsage.sentLast24h)} remaining</span>
              <span>Rolling window</span>
            </div>
          </div>
          <div className="adm-note" data-tone="violet">
            <Info size={14} />
            <span>
              <strong>Recommendation:</strong> keep name and email change requests deliberate, and stagger bulk
              notices so a single evening does not exhaust the daily cap.
            </span>
          </div>
        </section>

        {/* Infrastructure */}
        <section className="adm-limit-card" data-tone="warn">
          <div className="adm-limit-head">
            <h4 className="adm-limit-head__name"><Cpu size={17} /> Compute &amp; deployment</h4>
            <span className="adm-chip" data-tone="warn">Infrastructure</span>
          </div>

          <div>
            <div className="adm-subhead"><span>▲ Vercel — frontend (Hobby)</span></div>
            <ul className="adm-spec" style={{ marginTop: '0.35rem' }}>
              <li><strong>Bandwidth:</strong> 100 GB per month.</li>
              <li><strong>Serverless execution:</strong> 100 GB-hours per month.</li>
              <li><strong>Function timeout:</strong> 10 seconds.</li>
            </ul>
          </div>

          <div>
            <div className="adm-subhead">
              <span>⬡ Render — backend</span>
              <span className="adm-chip" data-tone="ok">Ping active</span>
            </div>
            <ul className="adm-spec" style={{ marginTop: '0.35rem' }}>
              <li><strong>Compute:</strong> 750 free instance hours per month.</li>
              <li><strong>Sleep:</strong> spins down after 15 minutes idle.</li>
              <li><strong>Anti-sleep:</strong> a self-ping runs every 14 minutes in production.</li>
            </ul>
          </div>

          <div>
            <div className="adm-subhead"><span><GitBranch size={13} style={{ verticalAlign: '-2px' }} /> GitHub</span></div>
            <ul className="adm-spec" style={{ marginTop: '0.35rem' }}>
              <li><strong>Actions:</strong> 2,000 build minutes per month.</li>
              <li><strong>Git LFS storage:</strong> 1 GB.</li>
              <li><strong>Git LFS bandwidth:</strong> 1 GB per month.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LimitsTab;