// LS1 sprint 2 item D2 evidence: the LAB row's layout toggle persists across a reload, the title shows the active
// layout (URL flag included), and changing the layout discards the run save. Drives the real title menu with keys
// and a touch tap, on a phone-sized landscape viewport, and writes title screenshots.
// Starts its own Vite server on a free port. Usage: node tools/lab-check.mjs [outDir]
// Exit code 1 on any failed check.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] || 'production/qa/evidence/ls1-d2';
fs.mkdirSync(OUT, { recursive: true });
const { createServer } = await import('vite');
// a worktree's node_modules is a symlink into the main checkout: allow its real path, or the bundled fonts are refused
// and the title falls back to a serif in the screenshots
const allow = [process.cwd(), fs.realpathSync('node_modules')];
const server = await createServer({ server: { port: 5299, strictPort: false, host: '127.0.0.1', fs: { allow } }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];

const fails = [], errs = [];
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails.push(what); };

const b = await chromium.launch();
// Fold 7 cover screen-ish 21:9 landscape, touch (the screens rig's phone viewport)
const ctx = await b.newContext({ viewport: { width: 904, height: 388 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
// a fresh save once: answered the flash question, no LAB key, and a run save to prove the toggle discards it.
// sessionStorage marks the first load so the reloads keep what the page stored
await ctx.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('labcheck')) {
      sessionStorage.setItem('labcheck', '1');
      localStorage.clear();
      localStorage.setItem('grodius.v1', '{"meta":{"v":3},"asked":true}');
      localStorage.setItem('grodius.run', '{"v":1}');
    }
  } catch (e) {}
});
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));

async function open(q = '') {
  await p.goto(base + q);
  await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
  // headless Chromium has no audio unlock, so the title gate would hold: drop it like a first tap does
  await p.evaluate(async () => { (await import('/src/state.ts')).$.gate = false; });
  await p.waitForTimeout(400);
}
const state = () => p.evaluate(async () => {
  const L = await import('/src/lab.ts'), M = await import('/src/menus.ts'), S = await import('/src/state.ts');
  return { lab: localStorage.getItem('grodius.lab'), run: localStorage.getItem('grodius.run'), active: L.activeLayout(), tag: M.layoutTag(), rows: M.titleItems().map((x) => x.l + (x.r ? ' = ' + x.r : '')), sel: S.$.menuSel };
});
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(120); } };
// tap a title row by its label, through the canvas pointer path (game coords -> page coords)
async function tap(label) {
  const pt = await p.evaluate(async (label) => {
    const M = await import('/src/menus.ts');
    const i = M.titleItems().findIndex((x) => x.l === label);
    const bx = window.__mb().find((m) => m.i === i), c = document.getElementById('c').getBoundingClientRect();
    return { x: c.left + (bx.x + bx.w / 2) / 480 * c.width, y: c.top + (bx.y + bx.h / 2) / 270 * c.height };
  }, label);
  await p.touchscreen.tap(pt.x, pt.y);
  await p.waitForTimeout(200);
}

// 1. fresh save: short, no LAB key
await open();
let s = await state();
check(s.lab === null && s.active.layout === 'short' && s.active.src === 'default', 'fresh save has no grodius.lab key and flies short');
check(s.tag === 'SHORT' && s.rows.at(-1) === 'LAB = SHORT', 'title LAB row shows SHORT: ' + s.rows.join(' | '));
check(s.rows[0] === 'DESCEND', 'DESCEND is still row 0 (harness and probes press Enter on it)');
await p.screenshot({ path: `${OUT}/title-lab-short.png` });

// 2. keys: down to LAB, open it, toggle LAYOUT; touch: tap MIDBOSSES twice (on, off) and CHECKPOINT once
await press('ArrowDown', s.rows.length - 1);
await press('Enter');
s = await state();
check(s.rows[0].startsWith('LAYOUT') && s.rows.length === 4, 'LAB sub-menu opens: ' + s.rows.join(' | '));
await press('Enter');
await tap('MIDBOSSES'); await tap('MIDBOSSES'); await tap('CHECKPOINT');
s = await state();
check(s.rows[0] === 'LAYOUT = LONG' && s.rows[2] === 'CHECKPOINT = ON DEATH', 'toggles by key and by touch: ' + s.rows.join(' | '));
check(JSON.parse(s.lab || '{}').layout === 'long' && JSON.parse(s.lab).cp === 'b', 'grodius.lab stored: ' + s.lab);
check(s.run === null, 'changing the layout discarded grodius.run');
await p.screenshot({ path: `${OUT}/lab-submenu-long.png` });
await tap('BACK');
s = await state();
check(s.rows.at(-1) === 'LAB = LONG' && s.tag === 'LONG', 'title shows LONG after the toggle');
await p.screenshot({ path: `${OUT}/title-lab-long.png` });

// 3. reload: still long
await p.reload();
await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
await p.evaluate(async () => { (await import('/src/state.ts')).$.gate = false; });
await p.waitForTimeout(400);
s = await state();
check(s.active.layout === 'long' && s.active.id === 'long4' && s.active.src === 'lab' && s.tag === 'LONG', 'after a reload the LAB is still LONG (' + s.active.id + ')');
await p.screenshot({ path: `${OUT}/title-lab-long-reloaded.png` });

// 4. a URL flag overrides the LAB, and the title says so
await open('?layout=short');
s = await state();
check(s.active.layout === 'short' && s.tag === 'SHORT (URL)', 'URL ?layout=short overrides LAB long: tag ' + s.tag);
await p.screenshot({ path: `${OUT}/title-url-override.png` });

check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
await server.close();
// what this check does not reach (tools rule: report what was not measured)
console.log('not measured: a run actually flying long4 (applyRunLayout is a stub until item D lands), the Fold APK app kill (Matt)');
console.log(fails.length ? `lab-check: ${fails.length} FAILED` : 'lab-check: all passed');
process.exit(fails.length ? 1 : 0);
