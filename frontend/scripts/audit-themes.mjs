#!/usr/bin/env node
/**
 * Theme audit.
 *
 * Reads the seed colours out of src/styles/themes.css and checks, for every
 * light AND dark variant of every family:
 *   - all six text-bearing contrast pairs against WCAG AA
 *   - that the two accents have not converged into a flat brand gradient
 * then checks the CSS agrees with the FAMILIES registry in ThemeContext.jsx.
 *
 * Exits non-zero on any failure, so it can gate a commit or CI run.
 *
 *   npm run audit:themes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AA = 4.5;
const AAA = 7;
/** Families that advertise a stricter bar than the rest. */
const STRICT = { signal: AAA };
/** Minimum OKLab distance between primary and secondary. Below this the
 *  --grad-brand gradient renders as a flat block. */
const MIN_ACCENT_GAP = 0.06;

const here = path.dirname(fileURLToPath(import.meta.url));
const themesFile = path.join(here, '..', 'src', 'styles', 'themes.css');
const contextFile = path.join(here, '..', 'src', 'context', 'ThemeContext.jsx');

// ── colour maths ──────────────────────────────────────────────────────────
const toRgb = (hex) => {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};

const toLinear = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [l1, l2] = [luminance(toRgb(a)), luminance(toRgb(b))];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Mirrors color-mix(in srgb, A pct, B) — the --grad-brand far stop. */
const mix = (a, b, pct) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return '#' + x
    .map((v, i) => Math.round(v * pct + y[i] * (1 - pct)).toString(16).padStart(2, '0'))
    .join('');
};

const oklab = (hex) => {
  const [r, g, b] = toRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const deltaE = (a, b) => {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

// ── parse themes.css ──────────────────────────────────────────────────────
const css = fs.readFileSync(themesFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const variants = [];

for (const block of css.matchAll(/(:root[^{]*)\{([^}]*)\}/g)) {
  const selector = block[1].trim();
  const m = selector.match(/data-theme="([a-z]+)"/);
  if (!m) continue; // the bare :root / :root.dark fallbacks
  const body = block[2];
  const get = (prop) => (body.match(new RegExp(`--${prop}:\\s*([^;]+);`)) || [])[1]?.trim();

  variants.push({
    family: m[1],
    mode: /\.dark/.test(selector) ? 'dark' : 'light',
    bg: get('bg-color'),
    text: get('text-main'),
    muted: get('text-muted'),
    primary: get('primary'),
    secondary: get('secondary'),
    onPrimary: get('on-primary'),
  });
}

// ── contrast report ───────────────────────────────────────────────────────
const CHECKS = [
  ['text/bg',      v => contrast(v.text, v.bg)],
  ['muted/bg',     v => contrast(v.muted, v.bg)],
  ['primary/bg',   v => contrast(v.primary, v.bg)],
  ['secondary/bg', v => contrast(v.secondary, v.bg)],
  ['ink/primary',  v => contrast(v.onPrimary, v.primary)],
  ['ink/gradient', v => contrast(v.onPrimary, mix(v.secondary, v.primary, 0.55))],
];

let failures = 0;
console.log(
  'family'.padEnd(10) + 'mode'.padEnd(7) +
  CHECKS.map(c => c[0].padStart(13)).join('') + '   accentGap'
);
console.log('-'.repeat(17 + CHECKS.length * 13 + 12));

for (const v of variants.sort((a, b) => a.family.localeCompare(b.family) || a.mode.localeCompare(b.mode))) {
  const bar = STRICT[v.family] || AA;
  let row = v.family.padEnd(10) + v.mode.padEnd(7);
  for (const [, fn] of CHECKS) {
    const r = fn(v);
    const ok = r >= bar;
    if (!ok) failures++;
    row += `${r.toFixed(2)}${ok ? ' ' : '!'}`.padStart(13);
  }
  const gap = deltaE(v.primary, v.secondary);
  const gapOk = gap >= MIN_ACCENT_GAP;
  if (!gapOk) failures++;
  row += `      ${gap.toFixed(3)}${gapOk ? '' : ' !'}`;
  console.log(row);
}

console.log();

// ── themes.css ⇄ ThemeContext.jsx ─────────────────────────────────────────
const ctx = fs.readFileSync(contextFile, 'utf8');
const drift = [];
const cssFamilies = new Map();
for (const v of variants) {
  if (!cssFamilies.has(v.family)) cssFamilies.set(v.family, {});
  cssFamilies.get(v.family)[v.mode] = v;
}

// Every family must ship both variants, or one mode renders the other's colours.
for (const [family, modes] of cssFamilies) {
  if (!modes.light) drift.push(`"${family}" has no light variant in themes.css`);
  if (!modes.dark) drift.push(`"${family}" has no dark variant in themes.css`);
}

const jsFamilies = new Set();
const re = /key:\s*'([a-z]+)'[^}]*?light:\s*\[\s*'(#[0-9a-fA-F]+)'\s*,\s*'(#[0-9a-fA-F]+)'\s*\][^}]*?dark:\s*\[\s*'(#[0-9a-fA-F]+)'\s*,\s*'(#[0-9a-fA-F]+)'\s*\]/g;
for (const m of ctx.matchAll(re)) {
  const [, key, lBg, lPri, dBg, dPri] = m;
  jsFamilies.add(key);
  const css = cssFamilies.get(key);
  if (!css) { drift.push(`ThemeContext lists "${key}" but themes.css has no such family`); continue; }
  const cmp = (label, a, b) => {
    if (a.toLowerCase() !== b.toLowerCase()) drift.push(`${key}: ${label} ${a} != ${b}`);
  };
  if (css.light) { cmp('light swatch bg', lBg, css.light.bg); cmp('light swatch accent', lPri, css.light.primary); }
  if (css.dark) { cmp('dark swatch bg', dBg, css.dark.bg); cmp('dark swatch accent', dPri, css.dark.primary); }
}

for (const family of cssFamilies.keys()) {
  if (!jsFamilies.has(family)) drift.push(`themes.css defines "${family}" but ThemeContext never offers it`);
}

// The bootstrap script in index.html duplicates the legacy migration table;
// if they disagree, a returning user gets one theme on first paint and another
// once React mounts.
const htmlFile = path.join(here, '..', 'index.html');
if (fs.existsSync(htmlFile)) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  // Comparing key PRESENCE is not enough: if the two tables agree on which
  // legacy names exist but disagree on where one of them lands, the bootstrap
  // paints one family and React swaps to another the moment it mounts. Compare
  // the mappings themselves, in both directions.
  const pairs = (block) => {
    const out = new Map();
    if (block) for (const m of block.matchAll(/(\w+):\s*'([a-z]+)'/g)) out.set(m[1], m[2]);
    return out;
  };
  const htmlLegacy = pairs((html.match(/var LEGACY = \{([\s\S]*?)\};/) || [])[1]);
  const ctxLegacy = pairs((ctx.match(/LEGACY_FAMILY\s*=\s*\{([\s\S]*?)\}/) || [])[1]);

  if (!htmlLegacy.size) drift.push('index.html has no LEGACY map — returning users would lose their theme');

  for (const [key, target] of ctxLegacy) {
    if (!cssFamilies.has(target)) drift.push(`legacy "${key}" migrates to "${target}", which is not a live family`);
    if (!htmlLegacy.has(key)) {
      drift.push(`legacy "${key}" is missing from the index.html bootstrap map`);
    } else if (htmlLegacy.get(key) !== target) {
      drift.push(`legacy "${key}": index.html maps it to "${htmlLegacy.get(key)}" but ThemeContext maps it to "${target}"`);
    }
  }
  for (const key of htmlLegacy.keys()) {
    if (!ctxLegacy.has(key)) drift.push(`legacy "${key}" is in the index.html map but not in ThemeContext`);
  }

  // Same story for which legacy names implied dark: disagreement here means the
  // page paints dark and React flips it to light, or the reverse.
  // The two tables spell membership differently — the bootstrap uses
  // `name: 1` object keys, ThemeContext uses a Set of quoted strings — so
  // each needs its own extractor. One shared extractor silently matches
  // nothing on the bootstrap side and reports all 13 entries as missing.
  const keysOf = (block, re) => new Set([...(block || '').matchAll(re)].map((m) => m[1]));
  const htmlDark = keysOf((html.match(/var DARK_LEGACY = \{([\s\S]*?)\};/) || [])[1], /(\w+):\s*1/g);
  const ctxDark = keysOf((ctx.match(/LEGACY_DARK = new Set\(\[([\s\S]*?)\]\)/) || [])[1], /'([a-z]+)'/g);
  if (!htmlDark.size || !ctxDark.size) drift.push('a legacy dark-theme table could not be parsed — this parity check is not actually running');
  for (const key of ctxDark) {
    if (!htmlDark.has(key)) drift.push(`legacy "${key}" is dark in ThemeContext but not in the bootstrap`);
  }
  for (const key of htmlDark) {
    if (!ctxDark.has(key)) drift.push(`legacy "${key}" is dark in the bootstrap but not in ThemeContext`);
  }

  // The bootstrap also whitelists family keys so an unknown stored value can
  // never reach data-theme. That list must cover exactly the live families.
  const bootFamilies = html.match(/var FAMILIES = \{([\s\S]*?)\};/);
  if (!bootFamilies) {
    drift.push('index.html bootstrap has no FAMILIES whitelist — an unknown stored theme would render unstyled');
  } else {
    const listed = new Set([...bootFamilies[1].matchAll(/(\w+):\s*1/g)].map(m => m[1]));
    for (const family of cssFamilies.keys()) {
      if (!listed.has(family)) drift.push(`"${family}" is missing from the index.html FAMILIES whitelist`);
    }
    for (const family of listed) {
      if (!cssFamilies.has(family)) drift.push(`index.html whitelists "${family}", which is not a live family`);
    }
  }
}

// Shuffle is driven from localStorage by BOTH the bootstrap and ThemeContext.
// If one renames a key the other keeps reading the old one, and nothing throws:
// shuffle just silently stops, or a stale lock keeps overriding the mode.
if (fs.existsSync(htmlFile)) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const keysIn = (src) => new Set(
    [...src.matchAll(/(?:getItem|setItem|read|write)\(\s*'(theme[A-Za-z]*)'/g)].map((m) => m[1]),
  );
  const bootKeys = keysIn(html);
  const ctxKeys = keysIn(ctx);
  for (const k of bootKeys) {
    if (!ctxKeys.has(k)) drift.push(`index.html uses storage key "${k}" but ThemeContext never does`);
  }
  for (const k of ctxKeys) {
    if (!bootKeys.has(k)) drift.push(`ThemeContext uses storage key "${k}" but the bootstrap never does`);
  }

  // A second roll in React would repaint the whole site the moment it mounts,
  // which is the exact flash the bootstrap exists to prevent.
  if (/Math\.random/.test(ctx) && !/bootFamily/.test(ctx)) {
    drift.push('ThemeContext rolls at random without reading the bootstrap result back — expect a flash');
  }
}

if (drift.length) {
  console.error('DRIFT:');
  drift.forEach(d => console.error('  ' + d));
}

if (failures || drift.length) {
  if (failures) console.error(`FAIL — ${failures} check(s) below target, marked !`);
  process.exit(1);
}

console.log(`All ${variants.length} variants across ${cssFamilies.size} families pass (AA 4.5:1, Signal AAA 7:1).`);
console.log('themes.css, ThemeContext.jsx and the index.html bootstrap agree.');
