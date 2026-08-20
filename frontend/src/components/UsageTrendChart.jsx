import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { History, LineChart, Minus, Table2, TrendingDown, TrendingUp } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   UsageTrendChart — the growth panel on the Admin Dashboard's Platform Limits
   tab. Four small multiples over the nightly usage snapshots.

   One measure per plot, each with its own y-scale, because the four series
   share no unit: 400 MB of Mongo and 12 emails on one pair of axes would
   invent a correlation that is not in the data. One series per facet also
   means no legend — the facet title already names what is plotted.

   The SVG is drawn at the measured pixel width rather than stretched from a
   viewBox, so the 2px stroke stays 2px on a phone and on the 1180px shell.
   Colour comes from styles/usage-chart.css via `data-series`; this file
   never names one.
   ────────────────────────────────────────────────────────────────────────── */

const RANGES = [30, 60, 90];

/* Plot geometry, in CSS pixels. The container is PAD_T + PLOT_H + AXIS_H tall
   so the date band sits inside the card and never opens a nested scrollbar.
   PAD_L is the y-tick gutter — wide enough for "512 MB" at 360px. */
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 12;
const PLOT_H = 140;
const AXIS_H = 24;
const CHART_H = PAD_T + PLOT_H + AXIS_H;

const DAY_MS = 86400000;
/* A cron writes one row a night, so consecutive points sit a day apart. A
   wider hop is a real outage: break the path there rather than draw a
   straight line across days that were never captured. */
const GAP_MS = DAY_MS * 1.5;

const DECIMAL_STEPS = [1, 2, 2.5, 5, 10];
const BINARY_STEPS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const BYTE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

const DAY_FMT = { month: 'short', day: 'numeric', timeZone: 'UTC' };
const FULL_FMT = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };

/* ── Value helpers ────────────────────────────────────────────────────── */

// Any nested section can be absent on an older row, and a null must not read
// as a zero — the caller skips the point instead.
const numeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Mirrors AdminPanel's formatBytes. That copy lives in a page module and is
// not exported, and a chart must not reach into a page for a helper.
const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const index = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  );
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${BYTE_UNITS[index]}`;
};

const formatBytesTick = (bytes) => formatBytes(bytes).replace(' Bytes', ' B');

const formatCount = (value) => Math.round(value).toLocaleString();
const formatCredits = (value) => value.toFixed(2);

// 'YYYY-MM-DD' is read as UTC midnight so the x-scale never shifts a day for
// an admin sitting east or west of the server.
const toTime = (snapshot) => {
  const raw = snapshot?.date;
  const parsed = typeof raw === 'string' && raw.length >= 10
    ? Date.parse(`${raw.slice(0, 10)}T00:00:00Z`)
    : Date.parse(snapshot?.capturedAt);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDay = (time) => new Date(time).toLocaleDateString(undefined, DAY_FMT);
const formatFull = (time) => new Date(time).toLocaleDateString(undefined, FULL_FMT);

// Round the top of a scale up to a readable tick. Bytes step in 1024s so the
// gridlines land on 8 MB / 16 MB instead of 9.54 MB.
const niceMax = (value, binary) => {
  if (!(value > 0)) return binary ? 1024 : 1;
  const base = binary ? 1024 : 10;
  const power = Math.pow(base, Math.floor(Math.log(value) / Math.log(base)));
  const steps = binary ? BINARY_STEPS : DECIMAL_STEPS;
  const norm = value / power;
  const step = steps.find((candidate) => norm <= candidate) || steps[steps.length - 1];
  return step * power;
};

const changeLabel = (delta, format, spanDays) => {
  const range = `${spanDays}\u2009d`;
  if (!delta) return `no change · ${range}`;
  return `${delta > 0 ? '+' : '\u2212'}${format(Math.abs(delta))} · ${range}`;
};

const linePath = (segment) =>
  segment
    .map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');

const areaPath = (segment, baseline) => {
  const base = baseline.toFixed(1);
  const head = segment[0];
  const tail = segment[segment.length - 1];
  const body = segment.map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return `M${head.x.toFixed(1)} ${base} ${body} L${tail.x.toFixed(1)} ${base} Z`;
};

// Keep the tooltip inside the plot rather than let it hang off either edge.
const tipLeft = (x, width) => Math.min(Math.max(x, 62), Math.max(62, width - 62));

/* ── The four measures ────────────────────────────────────────────────── */

const FACETS = [
  {
    key: 'storage',
    title: 'Database storage',
    caption: 'MongoDB logical data size',
    pick: (row) => numeric(row?.database?.dataSize),
    format: formatBytes,
    tick: formatBytesTick,
    binary: true,
  },
  {
    key: 'members',
    title: 'Members',
    caption: 'Registered accounts',
    pick: (row) => numeric(row?.counts?.users),
    format: formatCount,
    integer: true,
  },
  {
    key: 'emails',
    title: 'Emails sent / day',
    caption: 'Delivered in the trailing 24 hours',
    pick: (row) => numeric(row?.emails?.sentLast24h),
    format: formatCount,
    integer: true,
  },
  {
    key: 'credits',
    title: 'Cloudinary credits',
    caption: 'Consumed this billing month',
    pick: (row) => numeric(row?.cloudinary?.creditsUsage),
    format: formatCredits,
  },
];

const VIEWS = [
  { id: 'charts', label: 'Charts', icon: LineChart },
  { id: 'table', label: 'Table', icon: Table2 },
];

const buildSeries = (rows, facet) => {
  const points = [];
  rows.forEach((row) => {
    const time = toTime(row);
    const value = facet.pick(row);
    if (time === null || value === null) return;
    points.push({ time, value });
  });
  points.sort((a, b) => a.time - b.time);
  return points;
};

/* Real pixel width, measured. A viewBox stretch would scale the 2px stroke
   with the card and give each facet a different line weight. */
const useMeasuredWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry?.contentRect?.width || 0));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
};

/* ── One facet ────────────────────────────────────────────────────────── */

const Facet = ({ facet }) => {
  const { points } = facet;
  const [plotRef, width] = useMeasuredWidth();
  const [active, setActive] = useState(null);

  const geometry = useMemo(() => {
    if (!width || points.length < 2) return null;

    const innerW = Math.max(1, width - PAD_L - PAD_R);
    const baseline = PAD_T + PLOT_H;
    const firstTime = points[0].time;
    const lastTime = points[points.length - 1].time;
    const span = lastTime - firstTime || DAY_MS;

    /* Zero baseline. The mark is an area, and an area cropped above zero
       reads a two-percent week as a cliff. */
    let top = niceMax(Math.max(...points.map((point) => point.value)), facet.binary);
    if (facet.integer) top = Math.max(2, Math.ceil(top / 2) * 2);

    const placed = points.map((point) => ({
      ...point,
      x: PAD_L + ((point.time - firstTime) / span) * innerW,
      y: baseline - (Math.max(0, Math.min(point.value, top)) / top) * PLOT_H,
    }));

    const segments = [];
    placed.forEach((point, index) => {
      const previous = placed[index - 1];
      if (!previous || point.time - previous.time > GAP_MS) segments.push([point]);
      else segments[segments.length - 1].push(point);
    });

    /* Hit bands run midpoint to midpoint, so the pointer only has to be
       nearest a date — nobody can be asked to land on a 2px line. */
    const bands = placed.map((point, index) => {
      const left = index === 0 ? PAD_L : (placed[index - 1].x + point.x) / 2;
      const right = index === placed.length - 1
        ? PAD_L + innerW
        : (placed[index + 1].x + point.x) / 2;
      return { left, width: Math.max(1, right - left) };
    });

    const ticks = [0, top / 2, top].map((value) => ({
      value,
      y: baseline - (value / top) * PLOT_H,
      label: value === 0 ? '0' : (facet.tick || facet.format)(value),
    }));

    return { innerW, baseline, placed, segments, bands, ticks, firstTime, lastTime };
  }, [facet, points, width]);

  const delta = points.length > 1 ? points[points.length - 1].value - points[0].value : 0;

  if (points.length < 2) {
    return (
      <article className="utc-facet" data-series={facet.key}>
        <header className="utc-facet__head">
          <h5 className="utc-facet__title">{facet.title}</h5>
        </header>
        <p className="utc-facet__caption">{facet.caption}</p>
        <p className="utc-figure">{points.length ? facet.format(points[0].value) : '—'}</p>
        <p className="utc-thin">
          {points.length
            ? `Captured ${formatFull(points[0].time)} — a trend needs a second day.`
            : 'No reading captured in this window.'}
        </p>
      </article>
    );
  }

  const last = points[points.length - 1];
  const spanDays = Math.max(1, Math.round((last.time - points[0].time) / DAY_MS));
  const activePoint = geometry && active !== null ? geometry.placed[active] || null : null;
  const endPoint = geometry ? geometry.placed[geometry.placed.length - 1] : null;

  const stepTo = (index) => setActive(Math.min(points.length - 1, Math.max(0, index)));

  const onKeyDown = (event) => {
    const current = active === null ? points.length - 1 : active;
    if (event.key === 'ArrowRight') stepTo(current + 1);
    else if (event.key === 'ArrowLeft') stepTo(current - 1);
    else if (event.key === 'Home') stepTo(0);
    else if (event.key === 'End') stepTo(points.length - 1);
    else if (event.key === 'Escape') setActive(null);
    else return;
    event.preventDefault();
  };

  return (
    <article className="utc-facet" data-series={facet.key}>
      <header className="utc-facet__head">
        <h5 className="utc-facet__title">{facet.title}</h5>
        <span className="utc-facet__delta">
          {delta > 0 && <TrendingUp size={13} aria-hidden="true" />}
          {delta < 0 && <TrendingDown size={13} aria-hidden="true" />}
          {delta === 0 && <Minus size={13} aria-hidden="true" />}
          {changeLabel(delta, facet.format, spanDays)}
        </span>
      </header>
      <p className="utc-facet__caption">{facet.caption}</p>

      <div className="utc-plot" ref={plotRef} style={{ minHeight: CHART_H }}>
        {geometry && (
          <svg
            className="utc-svg"
            width={width}
            height={CHART_H}
            role="img"
            tabIndex={0}
            aria-label={`${facet.title}: ${points.length} nightly readings from ${formatFull(geometry.firstTime)} to ${formatFull(geometry.lastTime)}, latest ${facet.format(last.value)}. Press the left and right arrow keys to read one day at a time.`}
            onKeyDown={onKeyDown}
            onFocus={() => setActive((current) => (current === null ? points.length - 1 : current))}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            onPointerCancel={() => setActive(null)}
          >
            {geometry.ticks.map((tick) => (
              <g key={tick.value}>
                <line
                  className="utc-grid"
                  x1={PAD_L}
                  x2={PAD_L + geometry.innerW}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  className="utc-tick"
                  x={PAD_L - 8}
                  y={tick.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {geometry.segments.map((segment, index) => (
              <g key={`seg-${segment[0].time}-${index}`}>
                {segment.length > 1 && (
                  <>
                    <path className="utc-area" d={areaPath(segment, geometry.baseline)} />
                    <path className="utc-line" d={linePath(segment)} />
                  </>
                )}
                {segment.length === 1 && (
                  <circle className="utc-dot" cx={segment[0].x} cy={segment[0].y} r={4} />
                )}
              </g>
            ))}

            {/* The one direct label: the latest value, at the end of the line. */}
            <text
              className="utc-endlabel"
              x={PAD_L + geometry.innerW}
              y={Math.max(PAD_T + 9, endPoint.y - 12)}
              textAnchor="end"
            >
              {facet.format(last.value)}
            </text>
            <circle className="utc-dot" cx={endPoint.x} cy={endPoint.y} r={4.5} />

            <text className="utc-xtick" x={PAD_L} y={geometry.baseline + 17} textAnchor="start">
              {formatDay(geometry.firstTime)}
            </text>
            <text
              className="utc-xtick"
              x={PAD_L + geometry.innerW}
              y={geometry.baseline + 17}
              textAnchor="end"
            >
              {formatDay(geometry.lastTime)}
            </text>

            {activePoint && (
              <g>
                <line
                  className="utc-cross"
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={PAD_T}
                  y2={geometry.baseline}
                />
                <circle className="utc-dot" cx={activePoint.x} cy={activePoint.y} r={4.5} />
              </g>
            )}

            {geometry.bands.map((band, index) => (
              <rect
                key={`hit-${geometry.placed[index].time}-${index}`}
                className="utc-hit"
                x={band.left}
                y={PAD_T}
                width={band.width}
                height={PLOT_H}
                onPointerEnter={() => setActive(index)}
                onPointerMove={() => setActive(index)}
              />
            ))}
          </svg>
        )}

        <div
          className={activePoint ? 'utc-tip is-on' : 'utc-tip'}
          style={activePoint ? { left: `${tipLeft(activePoint.x, width)}px` } : undefined}
          aria-live="polite"
        >
          {activePoint && (
            <>
              <span className="utc-tip__value">{facet.format(activePoint.value)}</span>
              <span className="utc-tip__date">{formatFull(activePoint.time)}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

/* ── Panel ────────────────────────────────────────────────────────────── */

const UsageTrendChart = ({ snapshots, loading, days, onDaysChange }) => {
  const [view, setView] = useState('charts');
  const tabRefs = useRef([]);
  const baseId = useId();

  const rows = useMemo(() => (Array.isArray(snapshots) ? snapshots : []), [snapshots]);
  const facets = useMemo(
    () => FACETS.map((facet) => ({ ...facet, points: buildSeries(rows, facet) })),
    [rows]
  );

  const onTabKeyDown = (event, index) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next = null;
    if (keys[event.key]) next = (index + keys[event.key] + VIEWS.length) % VIEWS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = VIEWS.length - 1;
    if (next === null) return;
    event.preventDefault();
    setView(VIEWS[next].id);
    tabRefs.current[next]?.focus();
  };

  const summary = rows.length
    ? `${rows.length} nightly snapshot${rows.length === 1 ? '' : 's'} · last ${days} days`
    : `Nothing captured in the last ${days} days`;

  return (
    <section className="utc" aria-labelledby={`${baseId}-title`}>
      {/* One control row above all four facets — never one control per plot. */}
      <div className="adm-toolbar utc-bar">
        <div className="utc-bar__text">
          <h4 className="utc-bar__title" id={`${baseId}-title`}>Growth over time</h4>
          <span className="utc-bar__sub">
            {summary}
            {loading && rows.length ? ' · refreshing' : ''}
          </span>
        </div>
        <span className="adm-toolbar__spacer" />

        <div className="adm-pills" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className="adm-pill"
              data-tone="brand"
              aria-pressed={days === range}
              onClick={() => onDaysChange?.(range)}
            >
              {range} days
            </button>
          ))}
        </div>

        {rows.length > 0 && (
          <div className="adm-pills" role="tablist" aria-label="Trend view">
            {VIEWS.map((item, index) => {
              const ViewIcon = item.icon;
              const selected = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${item.id}`}
                  aria-controls={`${baseId}-panel-${item.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => { tabRefs.current[index] = el; }}
                  className="adm-pill"
                  data-tone="brand"
                  onClick={() => setView(item.id)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                >
                  <ViewIcon size={13} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading && !rows.length && (
        <div className="utc-facets" aria-hidden="true">
          {FACETS.map((facet) => (
            <div key={facet.key} className="adm-skel utc-skel" />
          ))}
        </div>
      )}

      {!loading && !rows.length && (
        <div className="adm-empty">
          <History size={38} className="adm-empty__icon" aria-hidden="true" />
          <h4 className="adm-empty__title">No history yet</h4>
          <p className="adm-empty__text">
            The first snapshot is captured tonight — a nightly job writes one row per day,
            so a trend appears once there are two.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div
            role="tabpanel"
            id={`${baseId}-panel-charts`}
            aria-labelledby={`${baseId}-tab-charts`}
            tabIndex={-1}
            hidden={view !== 'charts'}
          >
            {/* A refetch holds the previous render instead of flashing a skeleton. */}
            <div className={loading ? 'utc-facets is-stale' : 'utc-facets'}>
              {facets.map((facet) => (
                <Facet key={facet.key} facet={facet} />
              ))}
            </div>
          </div>

          {/* Every value the crosshair can show, reachable without a pointer. */}
          <div
            role="tabpanel"
            id={`${baseId}-panel-table`}
            aria-labelledby={`${baseId}-tab-table`}
            tabIndex={-1}
            hidden={view !== 'table'}
          >
            <div className={loading ? 'adm-table-wrap is-stale' : 'adm-table-wrap'}>
              <div className="adm-table-scroll">
                <table className="adm-table utc-table">
                  <caption className="utc-caption">
                    Every nightly snapshot in the selected window, oldest first.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      {FACETS.map((facet) => (
                        <th key={facet.key} scope="col" className="adm-td-right">
                          {facet.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const time = toTime(row);
                      return (
                        <tr key={row?.date || row?.capturedAt || index}>
                          <td className="utc-table__date">
                            {time === null ? '—' : formatFull(time)}
                          </td>
                          {FACETS.map((facet) => {
                            const value = facet.pick(row);
                            return (
                              <td key={facet.key} className="adm-td-right">
                                {value === null ? '—' : facet.format(value)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default UsageTrendChart;
