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

// 1. fresh save: long4 (the default since D24), no LAB key
await open();
let s = await state();
check(s.lab === null && s.active.id === 'long4' && s.active.src === 'default', 'fresh save has no grodius.lab key and flies long4 (D24)');
check(s.tag === 'LONG' && s.rows.at(-1) === 'LAB = LONG', 'title LAB row shows LONG: ' + s.rows.join(' | '));
check(s.rows[0] === 'DESCEND', 'DESCEND is still row 0 (harness and probes press Enter on it)');
await p.screenshot({ path: `${OUT}/title-lab-default-long.png` });
// a player who picked SHORT before D24: the rest of the check toggles from there (short -> long)
await p.evaluate(() => { localStorage.setItem('grodius.lab', '{"layout":"short","mids":"","cp":"a"}'); localStorage.setItem('grodius.run', '{"v":1}'); });
await open();
s = await state();
check(s.active.id === 'short' && s.active.src === 'lab' && s.rows.at(-1) === 'LAB = SHORT', 'a stored LAB short still flies short: ' + s.rows.at(-1));

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
check(s.active.id === 'long4' && s.active.src === 'lab' && s.tag === 'LONG', 'after a reload the LAB is still LONG (' + s.active.id + ')');
await p.screenshot({ path: `${OUT}/title-lab-long-reloaded.png` });

// 3b. start a run with the LAB on long: DESCEND (Enter on row 0) flies long4; screenshot the first seconds of Orbit
await press('Enter');
await p.waitForFunction(() => window.__G().state === 'play', null, { timeout: 10000 });
const run = async () => p.evaluate(async () => {
  const L = await import('/src/layout.ts'), g = window.__G();
  return { id: L.layout().id, kinds: L.layout().stages.map((r) => r.kind), level: L.layout().level, stage: g.G.stage, scroll: Math.round(g.G.scroll), state: g.state };
});
let r = await run();
check(r.id === 'long4' && r.stage === 0 && r.kinds[0] === 'orbit', `run start flies ${r.id} (${r.kinds.join(', ')}, level ${r.level}), stage ${r.stage}`);
for (const [n, ms] of [['long-orbit-1s', 1000], ['long-orbit-4s', 3000]]) {
  await p.waitForTimeout(ms);
  r = await run();
  console.log(`  ${n}: state ${r.state}, scroll ${r.scroll}`);
  await p.screenshot({ path: `${OUT}/${n}.png` });
}
check(r.state === 'play' && r.scroll > 0 && r.id === 'long4', 'still flying long4 after ~4 s (scroll ' + r.scroll + ')');

// 4. a URL flag overrides the LAB, and the title says so
await open('?layout=short');
s = await state();
check(s.active.id === 'short' && s.tag === 'SHORT (URL)', 'URL ?layout=short overrides LAB long: tag ' + s.tag);
await p.screenshot({ path: `${OUT}/title-url-override.png` });

check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
await server.close();
// what this check does not reach (tools rule: report what was not measured)
console.log('not measured: the long run past its first seconds (D\'s stage-clock / beat-probe own that), a LAB change made mid-run (the menu only exists on the title), the Fold APK app kill (Matt)');
console.log(fails.length ? `lab-check: ${fails.length} FAILED` : 'lab-check: all passed');
process.exit(fails.length ? 1 : 0);
