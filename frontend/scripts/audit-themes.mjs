#!/usr/bin/env node
/**
 * Theme contrast audit.
 *
 * Reads the seed colours straight out of src/styles/themes.css and checks
 * every text-bearing combination the UI actually renders against WCAG AA.
 * Exits non-zero on any failure so it can gate a commit or CI run.
 *
 *   node scripts/audit-themes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AA = 4.5;
const here = path.dirname(fileURLToPath(import.meta.url));
const themesFile = path.join(here, '..', 'src', 'styles', 'themes.css');
const contextFile = path.join(here, '..', 'src', 'context', 'ThemeContext.jsx');

// ── colour maths ──────────────────────────────────────────────────────────
const toRgb = (hex) => {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [l1, l2] = [luminance(toRgb(a)), luminance(toRgb(b))];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Mirrors color-mix(in srgb, A pct, B) for the --grad-brand far stop. */
const mix = (a, b, pct) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return '#' + x
    .map((v, i) => Math.round(v * pct + y[i] * (1 - pct)).toString(16).padStart(2, '0'))
    .join('');
};

// ── parse themes.css ──────────────────────────────────────────────────────
const css = fs.readFileSync(themesFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const themes = [];

for (const block of css.matchAll(/:root([^{]*)\{([^}]*)\}/g)) {
  const names = block[1].split(',').map(s => s.trim().replace(/^\.|^:root\.?/, '')).filter(Boolean);
  const body = block[2];
  const get = (prop) => (body.match(new RegExp(`--${prop}:\\s*([^;]+);`)) || [])[1]?.trim();

  const seeds = {
    bg: get('bg-color'),
    text: get('text-main'),
    muted: get('text-muted'),
    primary: get('primary'),
    secondary: get('secondary'),
    onPrimary: get('on-primary'),
  };
  if (!seeds.bg || !seeds.primary) continue;
  themes.push({ name: names[0] || 'light', ...seeds });
}

// ── report ────────────────────────────────────────────────────────────────
const checks = [
  ['text/bg',      t => contrast(t.text, t.bg)],
  ['muted/bg',     t => contrast(t.muted, t.bg)],
  ['primary/bg',   t => contrast(t.primary, t.bg)],
  ['secondary/bg', t => contrast(t.secondary, t.bg)],
  ['ink/primary',  t => contrast(t.onPrimary, t.primary)],
  ['ink/gradient', t => contrast(t.onPrimary, mix(t.secondary, t.primary, 0.55))],
];

let failures = 0;
console.log('theme'.padEnd(11) + checks.map(c => c[0].padStart(13)).join(''));
console.log('-'.repeat(11 + checks.length * 13));

for (const t of themes) {
  let row = t.name.padEnd(11);
  for (const [, fn] of checks) {
    const v = fn(t);
    const ok = v >= AA;
    if (!ok) failures++;
    row += `${v.toFixed(2)}${ok ? ' ' : '!'}`.padStart(13);
  }
  console.log(row);
}

console.log();

// ── themes.css ⇄ ThemeContext.jsx consistency ─────────────────────────────
// The picker reads its list from JS while the colours live in CSS. Nothing at
// runtime notices when the two drift, so a theme can end up selectable but
// unstyled, or styled but unreachable. Check both directions here.
const ctx = fs.readFileSync(contextFile, 'utf8');
const cssKeys = new Set(themes.map(t => t.name));
const jsKeys = new Set();
const drift = [];

for (const m of ctx.matchAll(/key:\s*'([a-z]+)'[^}]*?swatch:\s*\[\s*'(#[0-9a-fA-F]+)'\s*,\s*'(#[0-9a-fA-F]+)'/g)) {
  const [, key, swatchBg, swatchAccent] = m;
  jsKeys.add(key);
  const theme = themes.find(t => t.name === key);
  if (!theme) { drift.push(`ThemeContext lists "${key}" but themes.css has no :root.${key}`); continue; }
  if (swatchBg.toLowerCase() !== theme.bg.toLowerCase()) {
    drift.push(`${key}: swatch bg ${swatchBg} != --bg-color ${theme.bg}`);
  }
  if (swatchAccent.toLowerCase() !== theme.primary.toLowerCase()) {
    drift.push(`${key}: swatch accent ${swatchAccent} != --primary ${theme.primary}`);
  }
}

for (const key of cssKeys) {
  if (key !== 'light' && !jsKeys.has(key)) {
    drift.push(`themes.css defines :root.${key} but ThemeContext never offers it`);
  }
}

// A retired key must not also be a live theme, or migration would fight the picker.
const retiredBlock = ctx.match(/RETIRED_THEMES\s*=\s*\{([^}]*)\}/s);
if (retiredBlock) {
  for (const m of retiredBlock[1].matchAll(/(\w+):\s*'([a-z]+)'/g)) {
    const [, from, to] = m;
    if (jsKeys.has(from)) drift.push(`"${from}" is both a live theme and a retired alias`);
    if (!jsKeys.has(to)) drift.push(`retired "${from}" migrates to "${to}", which is not a live theme`);
  }
}

// ── every dark theme must opt into the dark elevation recipe ──────────────
// tokens.css inverts surfaces for dark grounds via an explicit selector list.
// A dark theme missing from it renders near-white cards on a near-black page,
// and nothing else catches that.
const tokensFile = path.join(here, '..', 'src', 'styles', 'tokens.css');
const tokens = fs.readFileSync(tokensFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const darkBlock = tokens.match(/((?::root\.[a-z]+,\s*)+:root\.[a-z]+)\s*\{[^}]*--surface-1/);
const darkListed = new Set(
  darkBlock ? [...darkBlock[1].matchAll(/:root\.([a-z]+)/g)].map(m => m[1]) : []
);

for (const t of themes) {
  if (t.name === 'light') continue;
  const isDark = luminance(toRgb(t.bg)) < 0.25;
  if (isDark && !darkListed.has(t.name)) {
    drift.push(`"${t.name}" has a dark background but is missing from the dark elevation list in tokens.css`);
  }
  if (!isDark && darkListed.has(t.name)) {
    drift.push(`"${t.name}" has a light background but is listed as dark in tokens.css`);
  }
}

if (drift.length) {
  console.error('DRIFT between themes.css, ThemeContext.jsx and tokens.css:');
  drift.forEach(d => console.error('  ' + d));
}

if (failures || drift.length) {
  if (failures) console.error(`FAIL — ${failures} combination(s) below WCAG AA (${AA}:1), marked !`);
  process.exit(1);
}
console.log(`All ${themes.length} themes pass WCAG AA (${AA}:1) on every checked pair.`);
console.log(`themes.css and ThemeContext.jsx agree on all ${jsKeys.size} selectable themes.`);
