#!/usr/bin/env node
/**
 * Executes the real pre-paint bootstrap out of index.html against a mocked
 * localStorage / matchMedia / document / clock and asserts what it does to
 * <html>.
 *
 * The bootstrap cannot be imported — it is an inline IIFE that must stay
 * dependency-free — so this extracts it verbatim and runs it in a vm. That
 * means the thing under test is the shipped code, not a copy of it.
 *
 *   npm run test:shuffle
 *
 * The test itself is mutation-tested: pass a path to a deliberately broken
 * copy of index.html as argv[2] and every assertion below should still be
 * able to fail.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlFile = process.argv[2] || path.join(here, '..', 'index.html');

const html = fs.readFileSync(htmlFile, 'utf8');
const match = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
if (!match) {
  console.error('Could not find the bootstrap IIFE in index.html');
  process.exit(1);
}
const BOOTSTRAP = match[1];

const T0 = 1_700_000_000_000; // fixed epoch; the bootstrap only ever reads Date.now()
const MINUTE = 60 * 1000;

/** Runs the bootstrap once. Returns what it left on <html> and in storage. */
const boot = ({ store = {}, osDark = false, rand = Math.random, now = T0, throwOnWrite = false } = {}) => {
  const storage = { ...store };
  const el = { className: '', style: {}, attrs: {} };

  const sandbox = {
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => {
        if (throwOnWrite) throw new Error('QuotaExceeded');
        storage[k] = String(v);
      },
    },
    window: { matchMedia: () => ({ matches: osDark }) },
    document: {
      documentElement: {
        set className(v) { el.className = v; },
        get className() { return el.className; },
        setAttribute: (k, v) => { el.attrs[k] = v; },
        style: el.style,
      },
    },
    Math: { ...Math, random: rand, floor: Math.floor },
    Date: { now: () => now },
    Object,
  };

  vm.createContext(sandbox);
  vm.runInContext(BOOTSTRAP, sandbox);

  return {
    mode: el.className,
    family: el.attrs['data-theme'],
    colorScheme: el.style.colorScheme,
    storage,
  };
};

const FAMILIES = [
  'azure', 'aurora', 'ember', 'dusk', 'rose', 'tide', 'mono', 'nord',
  'dracula', 'vapor', 'neon', 'roast', 'signal', 'slate', 'sage',
];

let failed = 0;
const check = (label, cond, detail = '') => {
  if (cond) { console.log(`  ok   ${label}`); return; }
  failed++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
};

/** Storage for a shuffling user who is mid-visit on `family`. */
const midVisit = (family, extra = {}) => ({
  themeShuffle: '1',
  themeRoll: family,
  themeRollMode: 'dark',
  themeRollAt: String(T0),
  ...extra,
});

console.log('\nShuffle OFF — the existing contract must be untouched');
{
  const r = boot({ store: { theme: 'dracula', themeMode: 'dark' } });
  check('a saved pick is honoured', r.family === 'dracula', `got ${r.family}`);
  check('a saved mode is honoured', r.mode === 'dark', `got ${r.mode}`);

  const sys = boot({ store: { theme: 'nord', themeMode: 'system' }, osDark: true });
  check('system still follows the OS', sys.mode === 'dark', `got ${sys.mode}`);

  const junk = boot({ store: { theme: 'not-a-theme' } });
  check('junk cannot reach data-theme', FAMILIES.includes(junk.family), `got ${junk.family}`);

  const legacy = boot({ store: { theme: 'cyberpunk' } });
  check('legacy key still migrates', legacy.family === 'neon' && legacy.mode === 'dark',
    `got ${legacy.family}/${legacy.mode}`);

  check('nothing is rolled', !('themeRoll' in boot({ store: { theme: 'rose' } }).storage));
}

console.log('\nShuffle ON — the roll');
{
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(boot({ store: { themeShuffle: '1', theme: 'dracula' } }).family);
  check('every roll is a live family', [...seen].every(f => FAMILIES.includes(f)),
    `stray: ${[...seen].filter(f => !FAMILIES.includes(f))}`);
  check('rolls cover all 15 families', seen.size === 15, `saw ${seen.size}`);

  let repeats = 0;
  for (const prev of FAMILIES) {
    for (let i = 0; i < 60; i++) {
      // Expired visit, so it must roll — but never back onto `prev`.
      const r = boot({ store: { themeShuffle: '1', themeRoll: prev, themeRollAt: String(T0 - 60 * MINUTE) }, now: T0 });
      if (r.family === prev) repeats++;
    }
  }
  check('never repeats the previous roll', repeats === 0, `${repeats} back-to-back repeats`);

  const r = boot({ store: { themeShuffle: '1', theme: 'dracula' } });
  check("a saved pick survives shuffle ('theme' untouched)", r.storage.theme === 'dracula',
    `theme is now ${r.storage.theme}`);
  check('the roll is recorded', FAMILIES.includes(r.storage.themeRoll));
}

console.log('\nShuffle ON — a VISIT, not a page load');
{
  // src/api.js:34 sends an expired session to /login via window.location.href.
  // OAuth redirects and ordinary reloads land here too.
  const reloads = new Set();
  for (let i = 0; i < 200; i++) {
    reloads.add(boot({ store: midVisit('nord'), now: T0 + 5 * MINUTE }).family);
  }
  check('a reload mid-visit does NOT re-roll', reloads.size === 1 && reloads.has('nord'),
    `saw ${[...reloads].join(',')}`);

  const modes = new Set();
  for (let i = 0; i < 200; i++) {
    modes.add(boot({ store: midVisit('nord'), now: T0 + 5 * MINUTE }).mode);
  }
  check('the lighting holds across a reload too', modes.size === 1 && modes.has('dark'),
    `saw ${[...modes].join(',')}`);

  const later = boot({ store: midVisit('nord'), now: T0 + 31 * MINUTE });
  check('a new visit after the gap rolls again', later.family !== 'nord', `still ${later.family}`);

  const touched = boot({ store: midVisit('nord'), now: T0 + 5 * MINUTE });
  check('the clock is refreshed on every load', touched.storage.themeRollAt === String(T0 + 5 * MINUTE),
    `themeRollAt is ${touched.storage.themeRollAt}`);

  // A remembered roll that is no longer a live family must not be reused.
  const stale = boot({ store: midVisit('cyberpunk'), now: T0 + 5 * MINUTE });
  check('a stale roll is discarded, not painted', FAMILIES.includes(stale.family), `got ${stale.family}`);
}

console.log('\nShuffle ON — mode, and who is protected from it');
{
  const modes = new Set();
  for (let i = 0; i < 200; i++) modes.add(boot({ store: { themeShuffle: '1' } }).mode);
  check('mode rolls both ways for someone who never chose', modes.size === 2,
    `saw ${[...modes].join(',')}`);

  const locked = new Set();
  for (let i = 0; i < 200; i++) {
    locked.add(boot({ store: { themeShuffle: '1', themeMode: 'dark', themeModeLocked: '1' } }).mode);
  }
  check('an explicit lock is never overridden', locked.size === 1 && locked.has('dark'),
    `saw ${[...locked].join(',')}`);

  // The migration that matters: the pre-shuffle app wrote themeMode on every
  // mount, so returning users have it WITHOUT themeModeLocked. Someone who
  // picked dark for photosensitivity must not be coin-flipped into white.
  const migrated = new Set();
  for (let i = 0; i < 300; i++) {
    migrated.add(boot({ store: { themeShuffle: '1', themeMode: 'dark' } }).mode);
  }
  check('a pre-existing dark choice is honoured without themeModeLocked',
    migrated.size === 1 && migrated.has('dark'), `saw ${[...migrated].join(',')}`);

  const migratedLight = new Set();
  for (let i = 0; i < 300; i++) {
    migratedLight.add(boot({ store: { themeShuffle: '1', themeMode: 'light' } }).mode);
  }
  check('a pre-existing light choice is honoured too',
    migratedLight.size === 1 && migratedLight.has('light'), `saw ${[...migratedLight].join(',')}`);

  // 'system' was also the default, so it is not evidence of a choice.
  const sys = new Set();
  for (let i = 0; i < 200; i++) sys.add(boot({ store: { themeShuffle: '1', themeMode: 'system' } }).mode);
  check('"system" is ambiguous, so it does not lock', sys.size === 2, `saw ${[...sys].join(',')}`);

  const families = new Set();
  for (let i = 0; i < 300; i++) {
    families.add(boot({ store: { themeShuffle: '1', themeMode: 'dark', themeModeLocked: '1' } }).family);
  }
  check('family keeps shuffling after the mode is locked', families.size > 5, `saw ${families.size}`);
}

console.log('\nStorage failures');
{
  const el = { className: '', attrs: {}, style: {} };
  const sandbox = {
    localStorage: { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } },
    window: { matchMedia: () => ({ matches: false }) },
    document: {
      documentElement: {
        set className(v) { el.className = v; },
        get className() { return el.className; },
        setAttribute: (k, v) => { el.attrs[k] = v; },
        style: el.style,
      },
    },
    Math, Object, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(BOOTSTRAP, sandbox);
  check('getItem throwing falls back instead of blocking the page',
    el.className === 'light' && el.attrs['data-theme'] === 'azure',
    `got ${el.className}/${el.attrs['data-theme']}`);
  check('the fallback still sets color-scheme for native controls',
    el.style.colorScheme === 'light', `got ${el.style.colorScheme}`);

  // Readable but unwritable: in-app webviews and QuotaExceeded. The page must
  // still paint a real theme rather than dropping to the catch-block default.
  const ro = boot({ store: { theme: 'dracula', themeMode: 'dark' }, throwOnWrite: true });
  check('a write failure does not lose a saved theme',
    ro.family === 'dracula' && ro.mode === 'dark', `got ${ro.family}/${ro.mode}`);
}

console.log();
if (failed) {
  console.error(`FAIL — ${failed} assertion(s)`);
  process.exit(1);
}
console.log('Bootstrap shuffle behaves correctly on every path.');
