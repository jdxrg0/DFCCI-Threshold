#!/usr/bin/env node
/**
 * Palette solver — repairs theme seed colours until they meet a contrast target.
 *
 * Authoring aid for src/styles/themes.css. Give it candidate seeds; it reports
 * every failing pair and returns the minimum LIGHTNESS adjustment that fixes
 * them. Hue and chroma are held constant (work is done in OKLCH, not HSL, so a
 * "10% lighter" step looks like an even step to the eye across every hue), which
 * means a repaired colour still reads as the colour the designer intended.
 *
 *   node scripts/solve-palette.mjs candidates.json [--target 4.5]
 *
 * Input: a JSON array of { key, label, type, bg, text, muted, primary,
 *                          primaryHover, secondary, onPrimary }
 * Output: the same array with colours repaired, plus a per-theme report on
 *         stderr and the CSS block on stdout.
 */
import fs from 'node:fs';

// ── sRGB ⇄ OKLab ──────────────────────────────────────────────────────────
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const hexToRgb = (hex) => {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

const rgbToHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');

const rgbToOklab = ([r, g, b]) => {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const oklabToLinear = ([L, A, B]) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * Gamut-map by reducing CHROMA, not by clamping channels.
 *
 * A saturated hue pushed to a very dark or very light L falls outside sRGB.
 * Clamping each channel independently there silently rotates the hue — driving
 * a dark yellow to #160000 (red) rather than #1a1400. Scaling a/b toward the
 * neutral axis keeps the hue and just desaturates, which is what a designer
 * would do by hand.
 */
const oklabToRgb = ([L, A, B]) => {
  let lin = oklabToLinear([L, A, B]);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear([L, A * mid, B * mid]))) lo = mid;
      else hi = mid;
    }
    lin = oklabToLinear([L, A * lo, B * lo]);
  }
  return lin.map((v) => toGamma(clamp01(v)));
};

/** Returns hex with OKLab lightness set to L, hue and chroma preserved. */
const withLightness = (hex, L) => {
  const [, A, B] = rgbToOklab(hexToRgb(hex));
  return rgbToHex(oklabToRgb([Math.min(1, Math.max(0, L)), A, B]));
};

const lightnessOf = (hex) => rgbToOklab(hexToRgb(hex))[0];

// ── WCAG ──────────────────────────────────────────────────────────────────
const relLum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** color-mix(in srgb, a pct, b) */
const mix = (a, b, pct) => {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(x.map((v, i) => v * pct + y[i] * (1 - pct)));
};

const gradEnd = (p) => mix(p.secondary, p.primary, 0.55);

const PAIRS = [
  ['text/bg',       (p) => [p.text, p.bg]],
  ['muted/bg',      (p) => [p.muted, p.bg]],
  ['primary/bg',    (p) => [p.primary, p.bg]],
  ['secondary/bg',  (p) => [p.secondary, p.bg]],
  ['ink/primary',   (p) => [p.onPrimary, p.primary]],
  ['ink/gradEnd',   (p) => [p.onPrimary, gradEnd(p)]],
];

const ratios = (p) => Object.fromEntries(PAIRS.map(([n, f]) => [n, contrast(...f(p))]));

/**
 * Walk `field`'s lightness away from `against` until the pair clears `target`.
 * Dark themes push accents lighter, light themes push them darker — decided by
 * which side of the background the colour already sits on.
 */
const solveAgainst = (palette, field, againstHex, target) => {
  const p = { ...palette };
  const start = lightnessOf(p[field]);
  const goLighter = lightnessOf(againstHex) < 0.5;
  const limit = goLighter ? 1 : 0;

  if (contrast(p[field], againstHex) >= target) return { palette: p, moved: 0 };

  // Coarse scan then bisect — the ratio is monotonic in L once past the bg.
  let lo = start;
  let hi = limit;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(withLightness(p[field], mid), againstHex) >= target) hi = mid;
    else lo = mid;
  }
  p[field] = withLightness(p[field], hi);
  return { palette: p, moved: Math.abs(hi - start) };
};

const solve = (input, target) => {
  let p = { ...input };
  const notes = [];
  const record = (field, moved, pair) => {
    if (moved > 0.001) {
      notes.push(`${field} lightness moved ${(moved * 100).toFixed(1)}% to clear ${pair}`);
    }
  };

  // Order matters: primary feeds three pairs, so settle it before its ink.
  for (const [field, against, pair] of [
    ['text', 'bg', 'text/bg'],
    ['muted', 'bg', 'muted/bg'],
    ['primary', 'bg', 'primary/bg'],
    ['secondary', 'bg', 'secondary/bg'],
  ]) {
    const r = solveAgainst(p, field, p[against], target);
    p = r.palette;
    record(field, r.moved, pair);
  }

  // onPrimary: pick whichever pole is further from the gradient, then refine.
  const end = gradEnd(p);
  const worst = (ink) => Math.min(contrast(ink, p.primary), contrast(ink, end));
  if (worst(p.onPrimary) < target) {
    const dark = withLightness(p.primary, 0.12);
    const light = '#ffffff';
    p.onPrimary = worst(dark) >= worst(light) ? dark : light;
    notes.push(`onPrimary flipped to ${p.onPrimary} (the other pole could not reach ${target}:1)`);
  }
  // If the ink still cannot clear the far stop, pull the gradient's reach in by
  // darkening/lightening secondary rather than abandoning the hue.
  let guard = 0;
  while (contrast(p.onPrimary, gradEnd(p)) < target && guard++ < 24) {
    const L = lightnessOf(p.secondary);
    p.secondary = withLightness(p.secondary, lightnessOf(p.onPrimary) > 0.5 ? L - 0.02 : L + 0.02);
  }
  if (guard > 0) notes.push(`secondary nudged ${guard} step(s) so ink clears the gradient far stop`);

  // primaryHover: keep it a readable step from primary, same side as before.
  const hoverUp = lightnessOf(input.primaryHover) >= lightnessOf(input.primary);
  p.primaryHover = withLightness(p.primary, lightnessOf(p.primary) + (hoverUp ? 0.08 : -0.08));

  return { palette: p, notes, ratios: ratios(p) };
};

// ── CLI ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const tIdx = args.indexOf('--target');
const defaultTarget = tIdx >= 0 ? Number(args[tIdx + 1]) : 4.5;

if (!file) {
  console.error('usage: node scripts/solve-palette.mjs <candidates.json> [--target 4.5]');
  process.exit(2);
}

const input = JSON.parse(fs.readFileSync(file, 'utf8'));
const out = [];

for (const cand of input) {
  // A theme may ask for a stricter bar than the batch default.
  const target = Number(cand.target) || defaultTarget;
  const { palette, notes, ratios: r } = solve(cand, target);
  const worstPair = Object.entries(r).sort((a, b) => a[1] - b[1])[0];
  const pass = worstPair[1] >= target;

  // Solving both accents against the same background can converge them onto the
  // same colour. That still passes WCAG but flattens --grad-brand into a solid,
  // so surface it rather than shipping a gradient that does not gradate.
  const [pl, pa, pb] = rgbToOklab(hexToRgb(palette.primary));
  const [sl, sa, sb] = rgbToOklab(hexToRgb(palette.secondary));
  const accentGap = Math.hypot(pl - sl, pa - sa, pb - sb);
  if (accentGap < 0.06) {
    notes.push(
      `WARNING primary ${palette.primary} and secondary ${palette.secondary} converged ` +
      `(OKLab distance ${accentGap.toFixed(3)}) — --grad-brand will look flat; ` +
      `pick a secondary in a different hue family`
    );
  }

  console.error(
    `${pass ? 'ok  ' : 'FAIL'} ${String(cand.key).padEnd(12)} target ${target}:1  ` +
    `worst ${worstPair[0]} ${worstPair[1].toFixed(2)}` +
    (notes.length ? `\n       ${notes.join('\n       ')}` : '')
  );

  out.push({ ...cand, ...palette, ratios: r, solvedTarget: target, pass });
}

const failed = out.filter((p) => !p.pass);
console.error(
  `\n${out.length - failed.length}/${out.length} palettes solved` +
  (failed.length ? ` — UNSOLVED: ${failed.map((p) => p.key).join(', ')}` : '')
);

// CSS on stdout so it can be piped straight into themes.css
const rgbTriplet = (hex) => hexToRgb(hex).map((v) => Math.round(v * 255)).join(', ');
for (const p of out) {
  console.log(`\n/* ${p.label} — ${p.character || ''} */`);
  console.log(`:root.${p.key} {`);
  console.log(`  --bg-color: ${p.bg};`);
  console.log(`  --text-main: ${p.text};`);
  console.log(`  --text-muted: ${p.muted};`);
  console.log(`  --primary: ${p.primary};`);
  console.log(`  --primary-hover: ${p.primaryHover};`);
  console.log(`  --secondary: ${p.secondary};`);
  console.log(`  --on-primary: ${p.onPrimary};`);
  console.log(`  --primary-rgb: ${rgbTriplet(p.primary)};`);
  console.log(`}`);
}

fs.writeFileSync(file.replace(/\.json$/, '.solved.json'), JSON.stringify(out, null, 2));
process.exit(failed.length ? 1 : 0);
