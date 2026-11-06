// The jump switch end to end (build plan LS1 row I): what the unit tests can't see, on a real page.
//   1. a valid jump starts play at the asked stage, and a stored RESUME survives it byte for byte: through the run's
//      checkpoint steps, its death, game over and a new game from the title;
//   2. a bad URL logs a console error and boots to the title, with no page error;
//   3. a clamped URL warns and still jumps;
//   4. a normal URL reaches the title with no jump and with RESUME offered.
// Usage: node tools/jump-check.mjs [url]     Starts its own Vite server when no url is given. Prints PASS/FAIL per
// check, exit 1 on a failure. Not measured: a deployed build (main.ts compiles the switch out; see the lane report).
import { chromium } from 'playwright';

let url = process.argv[2], server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5198, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
const KEY = 'grodius.run';
const b = await chromium.launch();
let bad = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!ok) bad++; };

/** a real checkpoint: boot normally, build one in-page from the switch's own blob, under its own run-save version */
async function makeBlob() {
  const p = await b.newPage();
  await p.goto(url + '?layout=long4');
  await p.waitForFunction(() => window.__started);
  const s = await p.evaluate(async () => {
    const J = await import('/src/jump.ts');
    const g = J.jumpBlob(J.parseJump('?stage=fire&x=900&kit=mid').jump, 3);
    g.g.seal = 1;
    return JSON.stringify(g);
  });
  await p.close();
  return s;
}
async function open(q, blob) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), logs = { error: [], warning: [], page: [] };
  p.on('console', (m) => { if (m.type() in logs && !/Failed to load resource|outside of Vite/.test(m.text())) logs[m.type()].push(m.text()); });
  p.on('pageerror', (e) => logs.page.push(e.message));
  await p.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true }));
    if (v) localStorage.setItem(k, v);
  }, [KEY, blob]);
  await p.goto(url + '?layout=long4' + q);
  await p.waitForFunction(() => window.__started);
  return { p, logs };
}
const state = (p) => p.evaluate(() => { const { G, state } = window.__G(); return { state, jump: !!(G && G.jump), stage: G && G.stage, loop: G && G.loop, scroll: G && G.scroll, lives: G && G.lives }; });
const stored = (p) => p.evaluate((k) => localStorage.getItem(k), KEY);

try {
  const blob = await makeBlob();
  // 1. the slot survives a whole jump run
  {
    const { p, logs } = await open('&stage=drive&x=200&loop=1&kit=mid&seed=7', blob);
    const s = await state(p);
    check('valid jump starts play at the stage', s.state === 'play' && s.jump && s.stage === 3 && s.loop === 1, JSON.stringify(s));
    await p.waitForFunction(() => window.__G().G.t > 200 && window.__cp().want !== 1, null, { timeout: 30000 });
    check('slot unchanged after 200+ frames of play', (await stored(p)) === blob);
    // the run's own end: every life gone, through the game's own kill path
    await p.evaluate(async () => {
      const f = await import('/src/flow.ts');
      window.__G().G.lives = 0;
      f.killPlayer();
    });
    await p.waitForFunction(() => window.__G().state === 'over', null, { timeout: 30000 });
    check('slot unchanged after game over', (await stored(p)) === blob);
    await p.evaluate(async () => { (await import('/src/flow.ts')).newGame(); });
    await p.waitForFunction(() => window.__G().G.t > 60, null, { timeout: 30000 });
    check('slot unchanged after a new game on the same page, and its checkpoint steps', (await stored(p)) === blob);
    check('no console or page errors in the jump run', !logs.error.length && !logs.page.length, JSON.stringify([...logs.error, ...logs.page]));
    await p.close();
  }
  // 2. bad URLs
  for (const q of ['&stage=nope', '&stage=orbit&x=99999', '&stage=orbit&x=-5', '&stage=orbit&kit=god', '&stage=orbit&loop=-1', '&stage=interior', '&stage=']) {
    const { p, logs } = await open(q, blob);
    const s = await state(p);
    check(`bad URL ${q}`, s.state === 'title' && logs.error.some((e) => e.startsWith('jump switch:')) && !logs.page.length, logs.error[0] || '(no console error)');
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    check(`  and the slot and the title's RESUME are intact`, (await stored(p)) === blob && (await p.evaluate(() => !!window.__cp().info)));
    await p.close();
  }
  // 3. clamped
  {
    const { p, logs } = await open('&stage=orbit&loop=99&rank=9', blob);
    const s = await state(p);
    check('clamped URL warns twice and jumps', s.state === 'play' && s.loop === 9 && logs.warning.filter((w) => w.startsWith('jump switch:')).length === 2, JSON.stringify(s));
    await p.close();
  }
  // 4. normal URL
  {
    const { p, logs } = await open('', blob);
    const s = await state(p);
    check('normal URL boots to the title, no jump, RESUME offered', s.state === 'title' && !s.jump && (await p.evaluate(() => !!window.__cp().info)) && !logs.page.length, JSON.stringify(s));
    await p.close();
  }
} finally {
  await b.close();
  if (server) await server.close();
}
console.log(bad ? `${bad} check(s) FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
