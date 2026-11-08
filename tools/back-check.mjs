// Back-control check (Matt's armory bug, LS1 audit S2 #1 and #2; src/backstep.ts). On a phone viewport (904x388,
// touch) and on desktop, for each screen: tap/click the visible back control once, fire the Android back mirror, Esc
// and pad B, and assert each goes exactly one level up (never an exit from a sub-menu). Also the DESCEND confirm
// with a run save. Counts pointerdown events on #c and logs $.menuSel after the first tap (does a Playwright touch
// tap reach the canvas at all?). Screenshots go to the out dir. Prints JSON; exits 1 on any failure.
//
// Usage (start a dev server first, one heavy job at a time):
//   node_modules/.bin/vite --port 5317 --strictPort &
//   node tools/back-check.mjs http://localhost:5317/ production/qa/evidence/ls1-audit-back
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5317/';
const OUT = process.argv[3] || 'production/qa/evidence/ls1-audit-back';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ['phone', { viewport: { width: 904, height: 388 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.6 }],
  ['desktop', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }],
];
const fails = [];
const res = {};
const b = await chromium.launch();

for (const [name, opt] of VIEWS) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    let now = 0;
    performance.now = () => now;
    window.requestAnimationFrame = () => 1; // the rig steps and renders by hand
    window.speechSynthesis = undefined;
    try { localStorage.clear(); } catch (e) {}
    window.__padB = false;
    navigator.getGamepads = () => [{ axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 1 && window.__padB })) }];
  });
  await p.goto(url);
  await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
  await p.evaluate(async () => {
    const imp = (m) => import(m);
    const [S, ST, F, M, RS, SV, BS, CP, C] = await Promise.all(['/src/state.ts', '/src/step.ts', '/src/flow.ts', '/src/menus.ts', '/src/render/screens.ts', '/src/save.ts', '/src/backstep.ts', '/src/checkpoint.ts', '/src/contraptions.ts'].map(imp));
    const $ = S.$;
    $.gate = false;
    SV.SET.asked = true;
    $.state = 'title';
    $.menuSel = 0;
    const g = (window.__g = { $, ST, F, M, RS, BS, CP, C, exits: 0, downs: 0 });
    document.getElementById('c').addEventListener('pointerdown', () => g.downs++, { capture: true });
    window.__st = (n) => { for (let i = 0; i < n; i++) ST.step(); RS.render(); return $.state; };
    // the main.ts backButton listener, minus App.exitApp(): backStep on a native view, then doBack
    window.__nback = () => { const a = BS.backStep(M.backView(true)); if (a === 'exit') g.exits++; else M.doBack(a); return a; };
    window.__title = () => { $.state = 'title'; $.menuSel = 0; if (M.titleSubOf()) M.doBack('closeSub'); $.menuSel = 0; window.__st(2); };
    window.__row = (l) => { const it = M.titleItems(), i = it.findIndex((x) => x.l === l); $.menuSel = i; it[i].a(); return i; };
    // where things are: the CSS centre of the menu box for row i (now: the button, else the row)
    window.__at = (i, now) => {
      const q = $.menuBoxes.find((m) => m.i === i && !!m.now === !!now), c = document.getElementById('c').getBoundingClientRect();
      if (!q) return null;
      return { x: c.x + (q.x + q.w / 2) * c.width / 480, y: c.y + (q.y + q.h / 2) * c.height / 270, box: { x: q.x, y: q.y, w: q.w, h: q.h } };
    };
    window.__look = () => ({ state: $.state, sub: M.titleSubOf(), sel: $.menuSel, shopNext: F.shopNext, msg: $.shopMsg && $.shopMsg.s, armed: M.armedRow(), exits: g.exits, run: !!$.G && $.state === 'play',
      rows: M.titleSubOf() ? null : { OPTIONS: M.titleItems().findIndex((x) => x.l === 'OPTIONS'), LAB: M.titleItems().findIndex((x) => x.l === 'LAB') },
      psHidden: document.getElementById('ps').hidden });
  });
  const ev = (s) => p.evaluate(s);
  const r = (res[name] = { scenes: {} });
  const ok = (scene, what, cond, got) => { if (!cond) fails.push(`${name}/${scene}/${what}: ${JSON.stringify(got)}`); return cond; };
  const press = async (pt) => (name === 'phone' ? p.touchscreen.tap(pt.x, pt.y) : p.mouse.click(pt.x, pt.y));

  // each scene: open it (past the shop's 40-frame lock), its back control (row index, on the button), the presses a
  // back takes (2 between descents), and what one level up looks like
  const SCENES = {
    shop_title: { open: `__title(); __row('INFIRMARY'); __st(45)`, ctl: `__g.M.shopItems().length - 1`, presses: 1, up: (l) => l.state === 'title' && !l.sub },
    shop_buy: {
      open: `__title(); __row('INFIRMARY'); __st(45); __g.$.meta.bio = 99999; __g.M.rigAct(__g.C.RIG[0]); __g.M.rigUp(__g.C.RIG[0]); __st(1)`,
      ctl: `__g.M.shopItems().length - 1`, presses: 1, up: (l) => l.state === 'title',
    },
    shop_loop: {
      open: `__title(); __g.F.newGame(0); __g.$.state = 'play'; __st(2); __g.F.openShop('loop'); __st(45)`,
      ctl: `__g.M.shopItems().length - 1`, presses: 2, up: (l) => l.state === 'play',
      half: (l) => l.state === 'shop' && l.msg === 'PRESS BACK AGAIN TO DESCEND',
    },
    opt: { open: `__title(); __row('OPTIONS'); __st(2)`, ctl: `__g.M.titleItems().findIndex((x) => x.l === 'BACK')`, presses: 1, up: (l) => l.state === 'title' && !l.sub && l.sel === l.rows.OPTIONS },
    lab: { open: `__title(); __row('LAB'); __st(2)`, ctl: `__g.M.titleItems().findIndex((x) => x.l === 'BACK')`, presses: 1, up: (l) => l.state === 'title' && !l.sub && l.sel === l.rows.LAB },
  };
  for (const [sc, S] of Object.entries(SCENES)) {
    const o = (r.scenes[sc] = {});
    // 1. the visible control, one tap / click
    await ev(S.open);
    await p.screenshot({ path: `${OUT}/${name}-${sc}.png` });
    const pt = await ev(`__at(${S.ctl}, true)`);
    o.button = pt && pt.box;
    ok(sc, 'pause II hidden off play/pause', (await ev('__look()')).psHidden, await ev('__look()'));
    if (ok(sc, 'button drawn', !!pt, pt)) {
      const d0 = await ev('__g.downs');
      await press(pt);
      o.downs = (await ev('__g.downs')) - d0;
      o.selAfterTap = await ev('__g.$.menuSel');
      await ev('__st(1)');
      o.tap = await ev('__look()');
      ok(sc, 'pointerdown reached #c', o.downs > 0, o.downs);
      ok(sc, 'one tap goes up', S.up(o.tap), o.tap);
    }
    // 2. Android back mirror, 3. Esc, 4. pad B: one level up (two presses between descents), never an exit
    for (const [k, fire] of [['android', () => ev('__nback()')], ['esc', () => p.keyboard.press('Escape')], ['padB', async () => { await ev('__padB = true; __st(1)'); await ev('__padB = false'); }]]) {
      await ev(S.open);
      const seq = [];
      for (let n = 0; n < S.presses; n++) {
        await fire();
        await ev('__st(1)');
        seq.push(await ev('__look()'));
        if (n < S.presses - 1) ok(sc, `${k} press ${n + 1} only selects`, S.half(seq[n]), seq[n]);
      }
      o[k] = seq;
      ok(sc, `${k} goes up`, S.up(seq[seq.length - 1]), seq);
      ok(sc, `${k} never exits`, seq.every((l) => l.exits === 0), seq);
      await ev('__g.exits = 0');
    }
  }
  // the title root: only the Android mirror exits there, and Esc does nothing
  await ev('__title()');
  r.root = { android: await ev('__nback()') };
  await p.keyboard.press('Escape');
  await ev('__st(1)');
  r.root.esc = await ev('__look()');
  ok('root', 'android exits', r.root.android === 'exit', r.root);
  ok('root', 'esc stays', r.root.esc.state === 'title' && !r.root.esc.sub, r.root);
  await ev('__g.exits = 0');

  // game over: X and pad B are POWER there too, so only Esc / Backspace / Android back SURFACE
  await ev(`__title(); __g.F.newGame(0); __g.$.state = 'over'; __g.$.G.overT = 80; __st(1)`);
  await p.keyboard.press('KeyX');
  await ev('__st(1)');
  await ev('__padB = true; __st(1)');
  await ev('__padB = false; __st(1)');
  r.over = { xPadB: await ev('__look()') };
  await p.keyboard.press('Escape');
  await ev('__st(1)');
  r.over.esc = await ev('__look()');
  ok('over', 'X and pad B stay on the over screen', r.over.xPadB.state === 'over', r.over);
  ok('over', 'Esc surfaces', r.over.esc.state === 'title', r.over);

  // DESCEND with a run save: the first tap arms (ENDS SAVED RUN), the second starts; Enter starts at once
  const withSave = `__title(); __g.F.newGame(0); __g.$.state = 'play'; __st(3); __g.CP.writeCp(0); __g.$.state = 'title'; __g.$.menuSel = 0; __st(2)`;
  const d = (r.descend = {});
  await ev(withSave);
  d.info = await ev('__g.M.titleItems().map((x) => x.l)');
  const di = await ev(`__g.M.titleItems().findIndex((x) => x.l === 'DESCEND')`);
  ok('descend', 'RE-ENTER offered', d.info[0] === 'RE-ENTER', d.info);
  const dp = await ev(`__at(${di}, false)`);
  if (ok('descend', 'row drawn', !!dp, dp)) {
    await press(dp);
    await ev('__st(1)');
    d.first = await ev(`({ ...__look(), r: __g.M.titleItems()[${di}].r })`);
    await p.screenshot({ path: `${OUT}/${name}-descend-armed.png` });
    ok('descend', 'first tap arms', d.first.state === 'title' && d.first.armed === di && d.first.r === 'ENDS SAVED RUN', d.first);
    await press(dp);
    await ev('__st(1)');
    d.second = await ev('__look()');
    ok('descend', 'second tap starts', d.second.state === 'play', d.second);
  }
  await ev(withSave);
  if (dp) {
    await press(dp);
    await ev(`__st(${181})`);
    d.timeout = await ev('__look()');
    ok('descend', 'arm times out after 180 frames', d.timeout.armed === null && d.timeout.state === 'title', d.timeout);
  }
  await ev(withSave + `; __g.$.menuSel = ${di}`);
  await p.keyboard.press('Enter');
  await ev('__st(1)');
  d.enter = await ev('__look()');
  ok('descend', 'Enter starts at once', d.enter.state === 'play', d.enter);

  r.errs = errs;
  ok('page', 'no page errors', errs.length === 0, errs);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ ok: fails.length === 0, fails, res }, null, 1));
process.exit(fails.length ? 1 : 0);
