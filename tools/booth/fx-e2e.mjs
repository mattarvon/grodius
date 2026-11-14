// The voice booth's FX rack, end to end (LS2-booth FX): drives the real booth page in headless Chromium with a fake
// mic that plays a synthesized voice-like WAV, against a running dev server, and checks the rack does what the page
// says. It keeps a take (with FX) in one slot, applies another rack to it, refuses a clipped take, and then deletes
// every file the run made under src/sfx/ and assets-raw/voice/ (anything there before the run is left alone).
//
//   1. the page loads with no console errors; the rack shows a card per effect (grouped) and the preset list
//   2. pick a line, record ~1.5 s (Space, wait, Space), pick Cyborg, press P: an FX preview with a duration
//   3. an effect on and a slider moved (input + change): the auto preview re-renders; the preset box says custom
//   4. Randomize and All off work; the rack survives a reload (localStorage)
//   5. the arrows on a focused slider move the slider, not the line (also after an auto preview lands); Space records
//   6. Keep (Enter) with a rack: the take lands in src/sfx/<cat>/ with the rack's name in the takes list and an fx
//      object in assets-raw/voice/<cat>/<take>.json; "Apply current FX to this line's takes" rewrites it
//   7. a clipped take previews with the "preview only" warning, and Keep is refused
//   8. the studio UI: the raw take's waveform, the live meter (take peak, peak hold), the preview deck's A and B
//      lanes with their LUFS readouts, A/B (B key) keeping the playhead, K play/pause, cached renders, a user preset
//      saved / loaded / exported / deleted / imported, the effect search, bypass keeping knob values, solo
//   +  no horizontal overflow at 1280x800 and 760x900; screenshots of the rack at both into the OS temp dir
//
// Usage: node tools/booth/fx-e2e.mjs [base=http://localhost:5199] [cat=hype100]
//   Needs the dev server of THIS checkout running (npm run dev, or npx vite --port 5199 --strictPort) with ffmpeg and
//   ffprobe on its PATH, and ffmpeg on this script's PATH (it makes the fake-mic WAVs). The script checks the server
//   serves this checkout before it records anything. Exit code 1 on any failed check. HEADED=1 env shows the browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// the rack itself (Node runs the .ts by stripping its types: fx.ts is a leaf with no imports)
import { EFFECTS, PRESETS } from './fx.ts';
const ORDER = EFFECTS.map((e) => e.id);
const presetIds = (name) => Object.keys(PRESETS.find((p) => p.name === name)?.fx ?? {});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = (process.argv[2] ?? 'http://localhost:5199').replace(/\/$/, '');
const CAT = process.argv[3] ?? 'hype100';
const TMP = path.join(os.tmpdir(), 'grodius-fx-e2e');
fs.mkdirSync(TMP, { recursive: true });

// ---------------- results ----------------
const results = [];
let failed = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}

// ---------------- the files this run may make ----------------
const DIRS = [path.join(ROOT, 'src', 'sfx', CAT), path.join(ROOT, 'assets-raw', 'voice', CAT), path.join(ROOT, 'assets-raw', 'voice', '.preview')];
const walk = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])); } catch { return []; } };
const before = new Set(DIRS.flatMap(walk));
const dirsBefore = new Set([path.join(ROOT, 'assets-raw'), path.join(ROOT, 'assets-raw', 'voice'), ...DIRS].filter((d) => fs.existsSync(d)));
function cleanup() {
  const made = DIRS.flatMap(walk).filter((f) => !before.has(f));
  for (const f of made) fs.rmSync(f, { force: true });
  // folders the run made, deepest first, only when empty
  for (const d of [...DIRS, path.join(ROOT, 'assets-raw', 'voice'), path.join(ROOT, 'assets-raw')]) {
    if (!dirsBefore.has(d) && fs.existsSync(d) && !fs.readdirSync(d).length) fs.rmdirSync(d);
  }
  return made.map((f) => path.relative(ROOT, f));
}

// ---------------- the fake mic ----------------
/** a voice-like tone: a 110 Hz buzz with harmonics, chopped into syllables (2.5 a second, short gaps between them)
 *  over a quiet pink room, its peak set to peakDb. clip: driven ~16 dB too hot and hard-clipped */
function wav(name, { peakDb = -10, clip = false } = {}) {
  const f = path.join(TMP, name), raw = path.join(TMP, 'raw-' + name);
  const voice = "aevalsrc='(sin(2*PI*110*t)+0.6*sin(2*PI*220*t)+0.45*sin(2*PI*330*t)+0.3*sin(2*PI*550*t)+0.2*sin(2*PI*880*t))*max(0,sin(2*PI*2.5*t))*(0.8+0.2*sin(2*PI*0.7*t))':s=48000:d=6";
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', voice, '-f', 'lavfi', '-i', 'anoisesrc=c=pink:a=0.004:r=48000:d=6',
    '-filter_complex', '[0:a]volume=0.25[v];[v][1:a]amix=inputs=2:normalize=0', '-ac', '1', '-c:a', 'pcm_f32le', raw]);
  // volumedetect reports on stderr
  const vd = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const peak = +(/max_volume: (-?[\d.]+) dB/.exec(vd)?.[1] ?? NaN);
  if (!Number.isFinite(peak)) throw new Error('ffmpeg volumedetect gave no peak: ' + vd.slice(-200));
  const gain = (clip ? peakDb + 16 : peakDb) - peak;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', `volume=${gain.toFixed(2)}dB${clip ? ',asoftclip=type=hard' : ''}`,
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', f]);
  fs.rmSync(raw, { force: true });
  return f;
}

// ---------------- the page ----------------
async function open(file, viewport = { width: 1280, height: 800 }) {
  const browser = await chromium.launch({
    headless: !process.env.HEADED,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${file}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text() + (m.location()?.url ? ' @ ' + m.location().url : '')));
  page.on('pageerror', (e) => errors.push(e.message));
  // which load failed, for a "Failed to load resource" console line
  page.on('requestfailed', (r) => !/ERR_ABORTED/.test(r.failure()?.errorText ?? '') && errors.push(`request failed: ${r.url().slice(0, 80)} ${r.failure()?.errorText ?? ''}`));
  // the booth confirms before a reprocess or a delete: this run accepts them
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + '/booth.html');
  await page.waitForSelector('#fx .fx');
  // the meter's AudioContext starts suspended until a gesture; the game's words arrive from the text frame
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => document.querySelectorAll('.slot .t').length && ![...document.querySelectorAll('.slot .t')].some((t) => t.textContent === '?'), null, { timeout: 15000 }).catch(() => {});
  return { browser, page, errors };
}
const state = (page) => page.locator('#status').innerText();
const fxSrc = (page) => page.evaluate(() => document.getElementById('fxplay')?.getAttribute('src') ?? '');
async function pickLine(page) {
  await page.locator('.slot', { hasText: CAT + '/' }).first().click();
  await page.waitForFunction((c) => document.querySelector('.slot.sel')?.textContent.includes(c + '/'), CAT);
}
/** Space, ~1.5 s, Space: waits for the raw take's player */
async function recordTake(page, ms = 1500) {
  await page.keyboard.press(' ');
  await page.waitForSelector('#b-rec.on', { timeout: 10000 });
  await page.waitForTimeout(ms);
  await page.keyboard.press(' ');
  await page.waitForSelector('#rawplay', { state: 'attached', timeout: 10000 });
}
/** waits for an FX preview other than `was` to land (and not be rendering), then its duration */
async function newPreview(page, was, timeout = 60000) {
  await page.waitForFunction((w) => {
    const a = document.getElementById('fxplay');
    return a && a.getAttribute('src') !== w && !document.getElementById('fx-prev')?.textContent.includes('Rendering');
  }, was, { timeout });
  return page.evaluate(() => new Promise((ok) => {
    const a = document.getElementById('fxplay');
    if (a.readyState >= 1 && Number.isFinite(a.duration)) return ok(a.duration);
    a.addEventListener('loadedmetadata', () => ok(a.duration), { once: true });
    a.addEventListener('error', () => ok(NaN), { once: true });
    a.load();
  }));
}
const presetText = (page) => page.evaluate(() => { const s = document.getElementById('fx-preset'); return s.options[s.selectedIndex]?.textContent ?? ''; });
/** the effects switched on, in chain order (the cards are grouped on screen) */
const onCards = (page) => page.evaluate(() => [...document.querySelectorAll('.fx.on [data-fx]')].map((c) => c.dataset.fx)).then((a) => a.sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y)));
/** horizontal overflow at this viewport: the page, and any element of the stage past the right edge */
const overflow = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  for (const el of document.querySelectorAll('#stage *, header *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 1) out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : ''} ends at ${Math.round(r.right)}`);
  }
  for (const el of document.querySelectorAll('.fx, .knob span, .knob output')) {
    if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.className || el.tagName.toLowerCase()} clips its text: ${el.textContent.trim().slice(0, 30)}`);
  }
  return [...new Set(out)].slice(0, 8);
});

// ---------------- the run ----------------
const marker = path.join(ROOT, 'tools', 'booth', `fx-e2e-marker-${randomBytes(6).toString('hex')}.txt`);
const shots = { desktop: path.join(TMP, 'booth-fx-rack-1280.png'), narrow: path.join(TMP, 'booth-fx-rack-760.png') };
let browsers = [];
try {
  // the server must serve this checkout: its keeps land in this checkout's src/sfx/, the folders cleaned up below
  const tag = randomBytes(8).toString('hex');
  fs.writeFileSync(marker, tag);
  const served = await fetch(BASE + '/tools/booth/' + path.basename(marker)).then((r) => (r.ok ? r.text() : ''), () => '');
  fs.rmSync(marker, { force: true });
  if (!served.includes(tag)) throw new Error(`${BASE} does not serve ${ROOT} (or is not running): start this checkout's dev server`);

  const voice = wav('voice-10dB.wav', { peakDb: -10 }), clipped = wav('voice-clipped.wav', { clip: true });

  // 1. load
  let { browser, page, errors } = await open(voice);
  browsers.push(browser);
  check('1 page loads with no console errors', !errors.length, errors.join(' | '));
  const cards = await page.locator('#fx .fx').count(), opts = await page.locator('#fx-preset option').allTextContents();
  check(`1 rack renders a card per effect (${EFFECTS.length})`, cards === EFFECTS.length, `${cards} cards`);
  const factory = await page.locator('#fx-factory option').count();
  check(`1 preset list holds the ${PRESETS.length} factory presets`, factory === PRESETS.length && opts.includes('Cyborg'), `${factory} factory, ${opts.length} options`);
  const groups = await page.locator('#fx-rack .grp').count();
  check('1 the rack is grouped', groups >= 2, `${groups} groups`);

  // 2. record, Cyborg, P
  await pickLine(page);
  await recordTake(page);
  check('2 Preview button enabled once a take is recorded', await page.locator('#fx-prev').isEnabled());
  await page.selectOption('#fx-preset', { label: 'Cyborg' });
  check('2 Cyborg sets its effects', JSON.stringify(await onCards(page)) === JSON.stringify(presetIds('Cyborg')), (await onCards(page)).join(','));
  await page.keyboard.press('p');
  let dur = await newPreview(page, '');
  check('2 P renders an FX preview with a duration', dur > 0.3, `${dur?.toFixed?.(2)} s; ${await page.locator('#fx-out').innerText().catch(() => '')}`);

  // 8. the studio UI, on the take in review and its Cyborg preview
  const drawn = (sel) => page.waitForSelector(sel, { timeout: 20000 }).then(() => true, () => false);
  check("8 the raw take's waveform and spectrogram draw", await drawn('#rv-wave canvas'));
  await page.waitForFunction(() => /dBFS/.test(document.getElementById('rv-read')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  check("8 the raw take's readout shows its duration and peak", /DUR\s*[\d.]+ s[\s\S]*PEAK\s*-?[\d.]+ dBFS/.test(await page.locator('#rv-read').innerText()), await page.locator('#rv-read').innerText());
  check('8 the meter held the take peak', /^-?[\d.]+ dBFS$/.test(await page.locator('#take-pk').innerText()), await page.locator('#take-pk').innerText());
  check('8 the live scope and spectrum are drawn', await page.evaluate(() => ['scope', 'rta'].every((id) => { const c = document.getElementById(id); return c.width > 10 && c.height > 10; })));
  check('8 the preview deck draws lane B (FX)', await drawn('#wave-b canvas'));
  check('8 the preview deck draws lane A (clean)', await drawn('#wave-a canvas'));
  await page.waitForFunction(() => /LUFS/.test(document.getElementById('read-a')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
  const ra = await page.locator('#read-a').innerText(), rb = await page.locator('#read-b').innerText();
  check('8 both lanes show LUFS / peak / duration from x-booth-info', /LUFS\s*-?[\d.]+/.test(ra) && /LUFS\s*-?[\d.]+/.test(rb) && /DUR/.test(rb), `A: ${ra} | B: ${rb}`);
  const deckState = () => page.evaluate(() => {
    const a = document.getElementById('cleanplay'), b = document.getElementById('fxplay');
    return { ab: document.querySelector('.deck.ab')?.dataset.ab, aMuted: a.muted, bMuted: b.muted, aT: a.currentTime, bT: b.currentTime, aP: a.paused, bP: b.paused };
  });
  await page.keyboard.press('k');
  await page.waitForTimeout(150);
  let ds = await deckState();
  if (ds.bP) { await page.keyboard.press('k'); await page.waitForTimeout(150); ds = await deckState(); } // it was still playing the autoplay: K paused it
  check('8 K plays the preview deck, A and B together', !ds.aP && !ds.bP, JSON.stringify(ds));
  await page.waitForTimeout(400);
  await page.keyboard.press('b');
  ds = await deckState();
  check('8 B switches to A (clean): A heard, B muted', ds.ab === 'A' && !ds.aMuted && ds.bMuted, JSON.stringify(ds));
  check('8 ... keeping the playhead', ds.aT > 0.15 && Math.abs(ds.aT - ds.bT) < 0.12, `A ${ds.aT.toFixed(2)} B ${ds.bT.toFixed(2)}`);
  await page.keyboard.press('b');
  ds = await deckState();
  check('8 B again switches back to the FX', ds.ab === 'B' && ds.aMuted && !ds.bMuted, JSON.stringify(ds));
  await page.keyboard.press('k');
  ds = await deckState();
  check('8 K pauses both', ds.aP && ds.bP, JSON.stringify(ds));
  // a bypassed effect keeps its knobs; going back to a rendered rack is a cached render (the same blob)
  const cyb = await fxSrc(page);
  await page.locator('#fx [data-fx=echo]').check();
  let u2 = await newPreview(page, cyb).then(() => fxSrc(page));
  await page.locator('#fx input[type=range][data-e=echo][data-k=ms]').evaluate((r) => { r.value = '300'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
  const u3 = await newPreview(page, u2).then(() => fxSrc(page));
  await page.locator('#fx [data-fx=echo]').uncheck();
  await newPreview(page, u3);
  check('8 bypassing an effect keeps its knob values', (await page.locator('#fx input[data-e=echo][data-k=ms]').inputValue()) === '300' && (await page.locator('#o-echo-ms').innerText()).startsWith('300'));
  check('8 ... and the rack it went back to comes from the render cache', (await fxSrc(page)) === cyb);
  await page.locator('#fx [data-fx=echo]').check();
  await newPreview(page, cyb);
  check('8 switching it back on brings its values back (cached render too)', (await fxSrc(page)) === u3 && (await onCards(page)).includes('echo'));
  await page.locator('#fx [data-fx=echo]').uncheck();
  await newPreview(page, u3);
  // solo
  await page.click('#fx [data-solo=robot]');
  await newPreview(page, cyb);
  const soloRow = await page.locator('#fx-out .row .state').first().innerText();
  check('8 solo previews that effect alone', /^robot/.test(soloRow) && (await page.locator('#fx-chain .solonote').count()) === 1, soloRow);
  check('8 ... and leaves the rack (and the keep) alone', JSON.stringify(await onCards(page)) === JSON.stringify(presetIds('Cyborg')));
  const soloSrc = await fxSrc(page);
  await page.click('#fx [data-solo=robot]');
  await newPreview(page, soloSrc);
  check('8 unsolo goes back to the whole rack', (await fxSrc(page)) === cyb && !(await page.locator('#fx-chain .solonote').count()));
  // search
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#fx-rack .fx')].filter((c) => c.offsetParent).map((c) => c.dataset.id));
  await page.fill('#fx-search', 'ring');
  const hits = await shown();
  check('8 the search filters the cards', hits.includes('ring') && hits.length < EFFECTS.length, hits.join(','));
  await page.locator('#fx-search').press('Escape');
  check('8 Escape clears the search', (await shown()).length === EFFECTS.length);
  await page.click('#fx-rack .grph >> nth=0');
  const folded = await page.evaluate(() => document.querySelector('#fx-rack .grp').classList.contains('shut'));
  await page.click('#fx-rack .grph >> nth=0');
  check('8 a group folds and unfolds', folded && !(await page.evaluate(() => document.querySelector('#fx-rack .grp').classList.contains('shut'))));
  // a user preset: save, load, export, delete, import
  const PN = 'E2E Hive ' + randomBytes(2).toString('hex');
  await page.fill('#fx-pname', PN);
  await page.locator('#fx-pname').press('Enter');
  check('8 Save adds the rack to Yours', (await page.locator('#fx-yours option').allTextContents()).includes(PN));
  check('8 ... and the preset box names it', (await presetText(page)) === PN, await presetText(page));
  await page.click('#fx-off');
  await page.selectOption('#fx-preset', { label: PN });
  check('8 loading the user preset brings its rack back', JSON.stringify(await onCards(page)) === JSON.stringify(presetIds('Cyborg')), (await onCards(page)).join(','));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#fx-export')]);
  const exported = path.join(TMP, 'presets-export.json');
  await dl.saveAs(exported);
  const ej = JSON.parse(fs.readFileSync(exported, 'utf8'));
  check('8 Export writes the presets as JSON', ej.presets?.some((p) => p.name === PN && Object.keys(p.fx).join(',') === presetIds('Cyborg').join(',')), JSON.stringify(ej).slice(0, 120));
  await page.click('#fx-del');
  check('8 Delete removes it', !(await page.locator('#fx-preset option', { hasText: PN }).count()));
  await page.setInputFiles('#fx-file', exported);
  await page.waitForFunction((n) => [...document.querySelectorAll('#fx-yours option')].some((o) => o.textContent === n), PN, { timeout: 5000 }).catch(() => {});
  check('8 Import brings it back', (await page.locator('#fx-yours option').allTextContents()).includes(PN), await state(page));
  await page.waitForFunction(() => !document.getElementById('fx-prev')?.textContent.includes('Rendering'), null, { timeout: 60000 });
  await newPreview(page, '').catch(() => {});

  // 3. an effect on, a slider moved: the auto preview follows; the preset box says custom
  let was = await fxSrc(page);
  await page.locator('#fx [data-fx=tremolo]').check();
  check('3 effect toggles on', (await onCards(page)).includes('tremolo'));
  dur = await newPreview(page, was);
  check('3 toggling an effect auto-previews', dur > 0.3, `${dur?.toFixed?.(2)} s`);
  was = await fxSrc(page);
  await page.locator('#fx input[type=range][data-e=tremolo][data-k=f]').evaluate((r) => {
    r.value = '20';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  check('3 slider output follows the knob', (await page.locator('#o-tremolo-f').innerText()) === '20.0 Hz', await page.locator('#o-tremolo-f').innerText());
  dur = await newPreview(page, was);
  check('3 moving a slider re-renders the auto preview', dur > 0.3, `${dur?.toFixed?.(2)} s`);
  check('3 the preset box shows custom', (await presetText(page)) === 'custom', await presetText(page));
  check('3 the rack title names the rack', (await page.locator('#fx h2 .state').innerText()).includes('tremolo'));

  // 4. Randomize, All off, reload
  await page.click('#fx-rand');
  const rnd = await onCards(page);
  check('4 Randomize turns on 2-5 effects', rnd.length >= 2 && rnd.length <= 5, rnd.join(','));
  await page.click('#fx-off');
  check('4 All off turns every effect off', !(await onCards(page)).length && (await page.locator('#fx h2 .state').innerText()).includes('off'));
  await page.selectOption('#fx-preset', { label: 'Cyborg' });
  await page.locator('#fx [data-fx=echo]').check();
  await page.locator('#fx input[type=range][data-e=echo][data-k=ms]').evaluate((r) => { r.value = '300'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
  const rack = await onCards(page);
  await page.reload();
  await page.waitForSelector('#fx .fx');
  check('4 the rack survives a reload', JSON.stringify(await onCards(page)) === JSON.stringify(rack) && (await page.locator('#fx input[data-e=echo][data-k=ms]').inputValue()) === '300',
    `${(await onCards(page)).join(',')} echo ${await page.locator('#fx input[data-e=echo][data-k=ms]').inputValue()}`);
  check('4 a reloaded custom rack still says custom', (await presetText(page)) === 'custom', await presetText(page));
  check('8 the user preset survives a reload', (await page.locator('#fx-yours option').allTextContents()).includes(PN));

  // 5. arrows on a focused slider; Space still records
  await page.mouse.click(5, 5);
  await pickLine(page);
  await recordTake(page);
  const slider = page.locator('#fx input[type=range][data-e=pitch][data-k=semi]');
  const sel0 = await page.locator('.slot.sel').getAttribute('data-i'), v0 = +(await slider.inputValue());
  await slider.focus();
  was = await fxSrc(page);
  await page.keyboard.press('ArrowRight');
  const v1 = +(await slider.inputValue());
  check('5 ArrowRight on a focused slider moves the slider', v1 > v0, `${v0} -> ${v1}`);
  check('5 ... and not the selected line', (await page.locator('.slot.sel').getAttribute('data-i')) === sel0);
  // the auto preview the arrow started lands: the slider must keep its focus through it
  await newPreview(page, was);
  check('5 the slider keeps focus after the auto preview lands', await page.evaluate(() => document.activeElement?.dataset?.e === 'pitch'),
    await page.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.id || '')));
  await page.keyboard.press('ArrowUp');
  const v2 = +(await page.locator('#fx input[type=range][data-e=pitch][data-k=semi]').inputValue());
  check('5 a second arrow still moves the slider, not the line', v2 > v1 && (await page.locator('.slot.sel').getAttribute('data-i')) === sel0, `${v1} -> ${v2}, line ${await page.locator('.slot.sel').getAttribute('data-i')}`);
  await page.locator('#fx input[type=range][data-e=pitch][data-k=semi]').focus();
  await page.keyboard.press(' ');
  const recOn = await page.waitForSelector('#b-rec.on', { timeout: 10000 }).then(() => true, () => false);
  check('5 Space on a focused slider still records', recOn);
  await page.waitForTimeout(1500);
  await page.keyboard.press(' ');
  await page.waitForSelector('#rawplay', { state: 'attached', timeout: 10000 });

  // screenshots and layout at 1280x800
  await page.waitForFunction(() => !document.getElementById('fx-prev')?.textContent.includes('Rendering'), null, { timeout: 60000 });
  let of = await overflow(page);
  check('layout: nothing overflows at 1280x800', !of.length, of.join('; '));
  await page.locator('#fx').screenshot({ path: shots.desktop });

  // 6. keep with the rack on, then apply another rack to the line
  const n0 = await page.locator('#takes .take').count();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^(Kept|Keep failed|Not kept)/.test(document.getElementById('status').textContent), null, { timeout: 90000 });
  const kept = await state(page);
  const name = /^Kept (\S+\.ogg)/.exec(kept)?.[1];
  check('6 Keep (Enter) with a rack on keeps the take', !!name && kept.includes(' with '), kept.slice(0, 160));
  const ogg = name && path.join(ROOT, 'src', 'sfx', CAT, name), opt = name && path.join(ROOT, 'assets-raw', 'voice', CAT, name.replace(/\.ogg$/, '.json'));
  check(`6 the take lands in src/sfx/${CAT}/ of this checkout`, ogg && fs.existsSync(ogg), ogg);
  await page.waitForFunction((n) => document.querySelectorAll('#takes .take').length > n, n0, { timeout: 10000 }).catch(() => {});
  const row = name ? page.locator('#takes .take', { hasText: name }) : null;
  const tag1 = row ? await row.locator('.fxtag').innerText().catch(() => '') : '';
  const rackName = await page.locator('#fx h2 .state').innerText();
  check("6 the takes list shows the rack's name", !!tag1 && tag1 === rackName, `${tag1} vs ${rackName}`);
  const j1 = opt && fs.existsSync(opt) ? JSON.parse(fs.readFileSync(opt, 'utf8')) : null;
  check('6 its assets-raw json has an fx object', j1?.fx && typeof j1.fx === 'object' && Object.keys(j1.fx).join(',') === (await onCards(page)).join(','), JSON.stringify(j1));
  const stat1 = ogg && fs.existsSync(ogg) ? fs.statSync(ogg) : null;
  // layout at 760 wide, with the long rack name in the takes list
  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForTimeout(200);
  of = await overflow(page);
  check('layout: nothing overflows at 760 wide', !of.length, of.join('; '));
  await page.locator('#fx').screenshot({ path: shots.narrow });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.selectOption('#fx-preset', { label: 'Ghost' });
  const ghost = await onCards(page);
  await page.waitForFunction(() => !document.getElementById('fx-prev')?.textContent.includes('Rendering'), null, { timeout: 60000 });
  await page.click('#b-apply');
  await page.waitForFunction(() => /^(Reprocessed|Reprocess failed|No raw)/.test(document.getElementById('status').textContent), null, { timeout: 90000 });
  const redo = await state(page);
  check("6 Apply current FX rewrites the line's takes", /^Reprocessed (\d+) of \1 /.test(redo + ' '), redo.slice(0, 160));
  const j2 = opt && fs.existsSync(opt) ? JSON.parse(fs.readFileSync(opt, 'utf8')) : null;
  check('6 ... its json now holds the applied rack', j2?.fx && Object.keys(j2.fx).join(',') === ghost.join(','), JSON.stringify(j2?.fx));
  const stat2 = ogg && fs.existsSync(ogg) ? fs.statSync(ogg) : null;
  check('6 ... and the .ogg was rewritten', stat1 && stat2 && (stat2.mtimeMs !== stat1.mtimeMs || stat2.size !== stat1.size), `${stat1?.size} -> ${stat2?.size} bytes`);
  const tag2 = name ? await page.locator('#takes .take', { hasText: name }).locator('.fxtag').innerText().catch(() => '') : '';
  check('6 ... and the takes list shows the new rack', tag2 === (await page.locator('#fx h2 .state').innerText()), tag2);
  // the FX preview of a kept take (its raw through the current rack)
  was = await fxSrc(page);
  if (name) await page.locator('#takes .take', { hasText: name }).locator('[data-fxp]').click();
  dur = await newPreview(page, was).catch(() => NaN);
  check("6 a kept take's FX preview button renders it", dur > 0.3, `${dur} s; ${await page.locator('#fx-src').innerText()}`);
  check('1 still no console errors after the run', !errors.length, errors.join(' | '));
  await browser.close();
  browsers = [];

  // 7. a clipped take: previewed with the warning, Keep refused
  ({ browser, page, errors } = await open(clipped));
  browsers.push(browser);
  await pickLine(page);
  const n1 = await page.locator('#takes .take').count();
  await page.selectOption('#fx-preset', { label: 'Robot' });
  await recordTake(page);
  const st7 = await state(page);
  check('7 the clipped take is flagged on stop', /^Raw take: .*CLIP/.test(st7), st7.slice(0, 120));
  check('7 a preset picked before the first take raises no stray warning', !/Record a take first/.test(st7));
  await page.keyboard.press('p');
  dur = await newPreview(page, '').catch(() => NaN);
  const warn = await page.locator('#fx .row .warn').innerText().catch(() => '');
  check('7 a clipped take still previews', dur > 0.3, `${dur} s`);
  check('7 ... with the "preview only" warning', /preview only/.test(warn), warn);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^(Kept|Keep failed|Not kept)/.test(document.getElementById('status').textContent), null, { timeout: 90000 });
  const refused = await state(page);
  check('7 Keep of a clipped take is refused', /^Not kept: .*clipped/.test(refused), refused.slice(0, 140));
  check('7 ... and no take was added', (await page.locator('#takes .take').count()) === n1);
  check('7 no console errors on the clipped run (the refusal is a 4xx/5xx, not a page error)', !errors.filter((e) => !/status of 422 .*\/__booth\/take\?/.test(e)).length, errors.join(' | '));
} catch (e) {
  check('the run finished', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' '));
} finally {
  for (const b of browsers) await b.close().catch(() => {});
  fs.rmSync(marker, { force: true });
  const gone = cleanup();
  console.log(`\ncleaned up ${gone.length} file${gone.length === 1 ? '' : 's'}: ${gone.join(', ') || 'none'}`);
  console.log(`screenshots: ${Object.values(shots).filter((f) => fs.existsSync(f)).join('  ')}`);
  console.log(`${results.length - failed} of ${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}
