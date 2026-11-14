// The voice booth page (LS2-booth, tools/booth/README.md): pick a line, record it on the chosen mic, hear the raw take,
// keep it (the dev plugin processes it into src/sfx/<cat>/) or discard it, hear the processed take, and open the game
// at the moment that plays it. Imports only the leaf modules (slots, names) and no CSS: anything that pulls in the
// Vite client would make every keep reload this page (tests/unit/booth.test.ts pins it). The words come from the
// game through the hidden text frame (text.ts). The waveform displays (wave.ts) load wavesurfer.js at runtime, by URL.
import { DIRECTION, SLOTS, quipSlot, type Slot } from './slots';
import { slugify } from './names';
import { normText, quipLines, textError, type Quip } from '../../src/voice/quiplist';
import * as FX from './fx';
import { EFFECTS, PRESETS, cleanFx, defaults, fxName, fxOn, randomFx, type Effect, type FxSet, type Knob } from './fx';
import { attach, type Disp } from './wave';

const $id = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const store = {
  get: (k: string) => { try { return localStorage.getItem('booth.' + k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem('booth.' + k, v); } catch { /* private window */ } },
};
/** the per-process token the plugin served this page with: every /__booth/ call carries it */
const TOKEN = document.querySelector<HTMLMetaElement>('meta[name=booth-token]')?.content ?? '';
/** a take running this long was forgotten: stop it */
const AUTO_STOP = 15;
/** the meter's marks, linear sample peaks (LS2-booth2, audio-director): HOT past -3 dBFS (the loudest syllable belongs
 *  at -10 to -6: the band booth.html draws), CLIP at -0.5 and above, where the plugin refuses the keep (plugin.ts
 *  rawVerdict, on the same rule; the plugin leaves the key clicks out, so a CLIP on a hard Space alone is kept) */
const HOT = 10 ** (-3 / 20), CLIP = 10 ** (-0.5 / 20);

// arming: Space pressed, the recorder not running yet (a second Space is ignored until it is)
type Phase = 'idle' | 'arming' | 'rec' | 'review' | 'saving' | 'saved' | 'error';
/** was: a quip's take recorded to words the quip no longer has (plugin.ts TakeOpts.text) */
type Take = { name: string; raw: boolean; was?: string; fx?: string };
type Kept = { name: string; url: string; lufs: number | null; peak: number | null; dur: number | null; gain: number; warn?: string; long?: string; squeezed?: number; src: string };
/** every line the booth shows: the fixed slots, then SLAB's quips (src/voice/quips.json, LS2-quips), rebuilt whenever
 *  the list is read or edited */
let ALL: Slot[] = [...SLOTS];
const S = {
  sel: Math.max(0, SLOTS.findIndex((s) => s.cat === store.get('slot'))),
  /** what quips.json holds that the booth could not read (a hand edit): shown, and every edit refused until fixed */
  quipErr: [] as string[],
  phase: 'idle' as Phase,
  msg: '',
  tone: '' as '' | 'err' | 'warn',
  text: {} as Record<string, { lines: string[]; name?: string; err?: string; face?: number; tag?: string }>,
  takes: {} as Record<string, Take[]>,
  stream: null as MediaStream | null,
  rec: null as MediaRecorder | null,
  chunks: [] as Blob[],
  raw: null as Blob | null,
  rawUrl: '',
  clipped: false,
  hot: false,
  /** shorten the take's pauses over 0.4 s to 0.25 s (plugin.ts VOX.squeeze): per take, back on after a keep or a line
   *  change (not on record: it may be unticked before Space) */
  squeeze: true,
  kept: null as Kept | null,
  t0: 0,
  /** the FX rack (fx.ts): what a keep, a preview and "apply to this line" use. Remembered across reloads */
  fx: (() => { try { return cleanFx(JSON.parse(store.get('fx') ?? '{}')); } catch { return {}; } })() as FxSet,
  /** the last take recorded on a line (kept or not), with that line: the FX preview's source when nothing else is
   *  picked, on that line only (a CLOSED CASKET take never previews under GRODIUS BITCH) */
  lastRaw: null as { cat: string; blob: Blob } | null,
  /** a kept take on disk picked for the FX preview (its raw take in assets-raw/voice/) */
  prevName: '',
  /** the preview deck: B is the render through the rack, clean (A) the same source with no FX, for the A/B */
  prev: null as { url: string; info: Info; clean: Render | null; cleanErr?: string } | null,
  prevBusy: false,
  /** every effect's knob values, on or bypassed: turning an effect off keeps its settings. Remembered across reloads */
  knobs: (() => { try { return cleanFx(JSON.parse(store.get('fxknobs') ?? '{}')); } catch { return {}; } })() as FxSet,
  /** an effect soloed: previews play it alone (the keep still uses the whole rack) */
  solo: null as string | null,
  /** which preview the deck lets through: A the clean take, B the rack */
  ab: 'B' as 'A' | 'B',
  /** a loop dragged on the preview's waveform */
  loop: null as { start: number; end: number } | null,
  /** the deck K plays: the take under review (or just kept), or the FX preview */
  deck: 'review' as 'review' | 'fx',
  /** the effect search box */
  q: '',
  /** the rack groups folded shut. Remembered */
  shut: new Set<string>((() => { try { const a = JSON.parse(store.get('fxshut') ?? '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } })()),
  spectro: store.get('spectro') !== '0',
  /** CLIP latched by this take (cleared by the next take or a click on the LED) */
  clipLatch: false,
  /** the loudest sample of the take being recorded */
  takePeak: 0,
};
type Info = { lufs?: number | null; peak?: number | null; dur?: number | null; fx?: string; warn?: string };
type Render = { url: string; info: Info };
const say = (msg: string, tone: '' | 'err' | 'warn' = '') => { S.msg = msg; S.tone = tone; };
const errText = (e: unknown) => String((e as Error)?.message ?? e);

/** the pause squeeze a line's takes start with: on, except a quip's (LS2-quips, audio-director: the beat in a quip is
 *  usually the joke, and its notes ask for the pause) */
const sqDefault = (s: Slot) => !s.quip;
const linesOf = (s: Slot) => s.quip ? quipLines(s.quip.text) : S.text[s.cat]?.lines?.length ? S.text[s.cat].lines : s.copy?.lines ?? [];
const slugOf = (s: Slot) => s.slug ?? slugify(linesOf(s).join(' '));
/** the caller's face from the game's own sheets, first jaw frame, 2x: SLAB_FACE (-1) is Matt's sheet, 0-5 the
 *  Reticulans' (render/hype.ts draws them the same way: frame (face * 3 + jaw) * 48) */
const FACE_W = 48, FACE_H = 52;
function faceImg(face?: number) {
  if (face == null) return '';
  const [url, i, n] = face < 0 ? ['/src/sprites/slab@3.png', 0, 3] : ['/src/sprites/hface@18.png', face * 3, 18];
  return `<div class="face" role="img" aria-label="caller face" style="background-image:url('${url}');background-size:${n * FACE_W * 2}px ${FACE_H * 2}px;background-position:-${i * FACE_W * 2}px 0"></div>`;
}

// ---------------- the game's words (text.ts posts them) ----------------
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin || ev.data?.booth !== 'text') return;
  S.text = ev.data.out;
  draw();
});

// ---------------- takes on disk ----------------
async function api(method: 'GET' | 'POST' | 'DELETE', q: Record<string, string>, body?: Blob, ep?: string) {
  const qs = Object.keys(q).length ? '?' + new URLSearchParams(q) : '';
  const r = await fetch('/__booth/' + (ep ?? (method === 'GET' ? 'takes' : 'take')) + qs, {
    method, body, headers: { 'x-booth': TOKEN, ...(body ? { 'content-type': body.type || (ep === 'quips' ? 'application/json' : 'audio/webm') } : {}) },
  });
  const j = await r.json().catch(() => ({ error: 'HTTP ' + r.status }));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { clipped: !!j.clipped });
  return j;
}
async function refreshTakes() {
  try { S.takes = await api('GET', {}); } catch (e) { say('Could not list takes: ' + errText(e), 'err'); }
  draw();
}

// ---------------- SLAB's quips (LS2-quips) ----------------
/** the list from the plugin -> ALL; the selection follows its line by folder (an edit or delete moves the rows) */
function setQuips(quips: Quip[], errors: string[] = S.quipErr, keep = ALL[S.sel]?.cat) {
  ALL = [...SLOTS, ...quips.map(quipSlot)];
  S.quipErr = errors;
  const was = ALL[S.sel]?.cat, i = ALL.findIndex((s) => s.cat === keep);
  S.sel = i >= 0 ? i : Math.min(S.sel, ALL.length - 1);
  if (ALL[S.sel].cat !== was || i < 0) S.squeeze = sqDefault(ALL[S.sel]); // landed on another line: its default
}
async function refreshQuips() {
  try {
    const r = await api('GET', {}, undefined, 'quips') as { quips: Quip[]; errors: string[] };
    setQuips(r.quips, r.errors, store.get('slot') ?? ALL[S.sel]?.cat);
  } catch (e) { say('Could not read the quip list: ' + errText(e), 'err'); }
  draw();
}
const busy = () => S.phase === 'arming' || S.phase === 'rec' || S.phase === 'saving' || S.phase === 'review';
/** one edit through the plugin (editQuips); the new list comes back */
async function quipOp(body: Record<string, unknown>) {
  const r = await api('POST', {}, new Blob([JSON.stringify(body)], { type: 'application/json' }), 'quips') as { quips: Quip[]; quip?: Quip };
  return r;
}
async function addQuip(raw: string) {
  const text = normText(raw), bad = textError(text);
  if (bad) return void (say(`Not added: ${bad}.`, 'err'), draw());
  if (busy()) return void (say('Finish this take first (keep or discard it).', 'warn'), draw());
  try {
    const r = await quipOp({ op: 'add', text });
    setQuips(r.quips, S.quipErr, r.quip ? 'quip-' + r.quip.id : undefined);
    store.set('slot', ALL[S.sel].cat);
    S.kept = null;
    S.phase = 'idle';
    const box = document.getElementById('q-new') as HTMLInputElement | null;
    if (box) { box.value = ''; box.blur(); }
    say(`Added ${text}: record it with Space.`);
  } catch (e) { say('Add failed: ' + errText(e), 'err'); await refreshQuips(); }
  await refreshTakes();
}
async function editQuip(s: Slot, raw: string) {
  const text = normText(raw), bad = textError(text), takes = S.takes[s.cat] ?? [];
  if (!s.quip || text === s.quip.text) return;
  if (bad) return void (say(`Not saved: ${bad}.`, 'err'), draw());
  if (busy()) return void (say('Finish this take first (keep or discard it).', 'warn'), draw());
  if (takes.length && !confirm(`Change the words to ${text}? Its ${takes.length} take${takes.length === 1 ? '' : 's'} keep their file names and are marked stale: they still say the old words until you record it again.`)) return draw();
  try {
    setQuips((await quipOp({ op: 'edit', id: s.quip.id, text })).quips);
    // out of the box, or the next Space types into it instead of recording (tools-programmer)
    (document.getElementById('q-text') as HTMLInputElement | null)?.blur();
    say(`Saved: ${text}.` + (takes.length ? ' Its older takes are marked stale.' : ''));
  } catch (e) { say('Save failed: ' + errText(e), 'err'); await refreshQuips(); }
  await refreshTakes();
}
async function delQuip(s: Slot) {
  if (!s.quip) return;
  if (busy()) return void (say('Finish this take first (keep or discard it).', 'warn'), draw());
  const n = (S.takes[s.cat] ?? []).length;
  if (!confirm(n ? `Delete the quip ${s.quip.text} AND its ${n} take${n === 1 ? '' : 's'} in src/sfx/${s.cat}/? Raw takes stay in assets-raw/voice/${s.cat}/.` : `Delete the quip ${s.quip.text}?`)) return;
  try {
    setQuips((await quipOp({ op: 'del', id: s.quip.id, ...(n ? { takes: true } : {}) })).quips, S.quipErr, '');
    store.set('slot', ALL[S.sel].cat);
    S.kept = null;
    S.phase = 'idle';
    say(`Deleted ${s.quip.text}${n ? ` and its ${n} take${n === 1 ? '' : 's'}` : ''}.`);
  } catch (e) { say('Delete failed: ' + errText(e), 'err'); await refreshQuips(); }
  await refreshTakes();
}

// ---------------- mic, meter, the live input monitor ----------------
let actx: AudioContext | null = null, an: AnalyserNode | null = null, src: MediaStreamAudioSourceNode | null = null;
const buf = new Float32Array(2048), fbuf = new Float32Array(1024);
let hold = 0, holdAt = 0, clipUntil = 0, hotUntil = 0, opening: Promise<void> | null = null;
function openMic(id?: string | null): Promise<void> {
  return (opening ||= (async () => {
    S.stream?.getTracks().forEach((t) => t.stop());
    S.stream = null;
    // the booth does its own cleanup (plugin.ts processTake): the browser's echo cancel, noise gate and AGC would pump
    // the level and smear the words before ffmpeg ever sees them
    const audio: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
    if (id) audio.deviceId = { exact: id };
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (e) {
      if (id) { opening = null; return openMic(null); } // the saved mic is unplugged: fall back to the default
      S.phase = 'error';
      say((e as Error).name === 'NotAllowedError'
        ? 'Mic blocked. Click the icon at the left of the address bar, allow Microphone, then reload.'
        : 'No mic: ' + errText(e), 'err');
      return draw();
    }
    const track = S.stream.getAudioTracks()[0];
    track.onended = () => {
      // unplugged (a USB mic), or the device went away: say so instead of recording silence
      if (S.rec?.state === 'recording') S.rec.stop();
      S.stream = null;
      S.phase = 'error';
      say('Mic disconnected. Pick another in the header, or press Space to retry the default.', 'err');
      listMics();
      draw();
    };
    actx ||= new AudioContext();
    src?.disconnect();
    src = actx.createMediaStreamSource(S.stream);
    an = actx.createAnalyser();
    an.fftSize = 2048;
    an.smoothingTimeConstant = 0.7;
    src.connect(an);
    if (S.phase === 'error') { S.phase = 'idle'; say(''); }
    await listMics();
    draw();
  })().finally(() => (opening = null)));
}
async function listMics() {
  const sel = $id('mic') as HTMLSelectElement;
  const cur = S.stream?.getAudioTracks()[0]?.getSettings().deviceId;
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  sel.innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? ' selected' : ''}>${esc(d.label || 'mic ' + (i + 1))}</option>`).join('');
}
($id('mic') as HTMLSelectElement).onchange = (e) => {
  const el = e.target as HTMLSelectElement;
  store.set('mic', el.value);
  el.blur(); // or the arrows go on changing the mic instead of the line
  openMic(el.value);
};
navigator.mediaDevices?.addEventListener?.('devicechange', () => listMics());
// a context made before any gesture starts suspended in Chrome: the meter reads nothing until the first click or key
const wake = () => actx?.state === 'suspended' && actx.resume().then(draw);
addEventListener('pointerdown', wake, true);
addEventListener('keydown', wake, true);
// the CLIP LED latches for the take; a click clears it
$id('clip').onclick = () => { S.clipLatch = false; clipUntil = 0; };
const dbOf = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
/** -60..0 dBFS -> 0..100% of the meter */
const pct = (v: number) => Math.max(0, Math.min(100, (dbOf(v) + 60) / 60 * 100));
/** the scrolling input scope: one min/max column per frame, the newest at the right */
const COLS = 360, scope = new Float32Array(COLS * 2), scopeRec = new Uint8Array(COLS);
let scopeAt = 0;
/** the spectrum's bands (log-spaced 50 Hz-16 kHz) and their falling peak dots */
const BANDS = 40, bandPk = new Float32Array(BANDS).fill(-120);
function fit(c: HTMLCanvasElement) {
  const d = devicePixelRatio || 1, w = Math.max(1, Math.round(c.clientWidth * d)), h = Math.max(1, Math.round(c.clientHeight * d));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c.getContext('2d')!;
}
function drawScope() {
  const c = document.getElementById('scope') as HTMLCanvasElement | null;
  if (!c || !c.clientWidth) return;
  const g = fit(c), W = c.width, H = c.height, mid = H / 2, cw = W / COLS, rec = S.phase === 'rec';
  g.fillStyle = rec ? '#1c0306' : '#070405';
  g.fillRect(0, 0, W, H);
  // the target band (-10 to -6 dBFS) and the CLIP line, both sides of the zero line
  const y = (v: number) => v * mid * 0.96;
  g.fillStyle = '#ffffff0d';
  for (const s of [-1, 1]) g.fillRect(0, mid - s * y(0.5), W, s * (y(0.5) - y(0.316)));
  g.fillStyle = '#ff4a5a55';
  for (const s of [-1, 1]) g.fillRect(0, mid - s * y(CLIP), W, 1);
  g.fillStyle = '#ffffff14';
  g.fillRect(0, mid, W, 1);
  for (let i = 0; i < COLS; i++) {
    const j = (scopeAt + i) % COLS, lo = scope[j * 2], hi = scope[j * 2 + 1], p = Math.max(-lo, hi);
    if (!p) continue;
    g.fillStyle = p >= CLIP ? '#ff4a5a' : p > HOT ? '#e8b34a' : scopeRec[j] ? '#ff8a94' : '#6fd08c';
    g.fillRect(i * cw, mid - y(hi), Math.max(1, cw - 0.3), Math.max(1, y(hi) - y(lo)));
  }
  if (rec) {
    g.fillStyle = '#ff4a5a';
    g.font = `${Math.round(10 * (devicePixelRatio || 1))}px Silkscreen, monospace`;
    g.fillText('REC', 6 * (devicePixelRatio || 1), 14 * (devicePixelRatio || 1));
  }
}
function drawRta() {
  const c = document.getElementById('rta') as HTMLCanvasElement | null;
  if (!c || !c.clientWidth || !an || !actx) return;
  an.getFloatFrequencyData(fbuf);
  const g = fit(c), W = c.width, H = c.height, ny = actx.sampleRate / 2, bw = W / BANDS;
  g.fillStyle = '#070405';
  g.fillRect(0, 0, W, H);
  for (let b = 0; b < BANDS; b++) {
    const f0 = 50 * (16000 / 50) ** (b / BANDS), f1 = 50 * (16000 / 50) ** ((b + 1) / BANDS);
    const i0 = Math.floor(f0 / ny * fbuf.length), i1 = Math.max(i0 + 1, Math.ceil(f1 / ny * fbuf.length));
    let m = -140;
    for (let i = i0; i < i1 && i < fbuf.length; i++) m = Math.max(m, fbuf[i]);
    // -100..-20 dB full scale
    const t = Math.max(0, Math.min(1, (m + 100) / 80)), h = t * H;
    bandPk[b] = Math.max(m, bandPk[b] - 0.6);
    const grd = g.createLinearGradient(0, H, 0, 0);
    grd.addColorStop(0, '#5a0d16');
    grd.addColorStop(0.7, '#d23a48');
    grd.addColorStop(1, '#ffb080');
    g.fillStyle = grd;
    g.fillRect(b * bw + 0.5, H - h, Math.max(1, bw - 1.5), h);
    const pt = Math.max(0, Math.min(1, (bandPk[b] + 100) / 80));
    g.fillStyle = '#ffe7ea';
    g.fillRect(b * bw + 0.5, H - pt * H, Math.max(1, bw - 1.5), Math.max(1, (devicePixelRatio || 1)));
  }
}
function meter() {
  requestAnimationFrame(meter);
  $id('hint').textContent = actx?.state === 'suspended' ? 'click anywhere to start the meter' : '';
  syncDeck();
  if (!an) return;
  const now = performance.now();
  an.getFloatTimeDomainData(buf);
  let p = 0, lo = 0, hi = 0, sq = 0;
  // the scope column: about one frame's worth of the newest samples
  const tail = Math.min(buf.length, Math.round((actx?.sampleRate ?? 48000) / 60));
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    p = Math.max(p, Math.abs(v));
    sq += v * v;
    if (i >= buf.length - tail) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const rms = Math.sqrt(sq / buf.length);
  scope[scopeAt * 2] = lo;
  scope[scopeAt * 2 + 1] = hi;
  scopeRec[scopeAt] = S.phase === 'rec' ? 1 : 0;
  scopeAt = (scopeAt + 1) % COLS;
  // peak hold: holds 1.5 s, then falls
  if (p >= hold) { hold = p; holdAt = now; } else if (now - holdAt > 1500) hold *= 0.94;
  if (p >= CLIP) { clipUntil = now + 1500; if (S.phase === 'rec') { S.clipped = true; S.clipLatch = true; } }
  if (p > HOT) { hotUntil = now + 1500; if (S.phase === 'rec') S.hot = true; }
  if (S.phase === 'rec') S.takePeak = Math.max(S.takePeak, p);
  ($id('lvl') as HTMLElement).style.width = pct(p) + '%';
  ($id('rmsb') as HTMLElement).style.width = pct(rms) + '%';
  ($id('hold') as HTMLElement).style.left = `calc(${pct(hold)}% - 1px)`;
  ($id('hold') as HTMLElement).classList.toggle('off', hold < 0.001);
  $id('pk').textContent = (hold > 0 ? dbOf(hold).toFixed(1) : '-inf') + ' dB';
  $id('clip').classList.toggle('on', now < clipUntil || S.clipLatch);
  $id('hot').classList.toggle('on', now < hotUntil && now >= clipUntil && !S.clipLatch);
  const tp = document.getElementById('take-pk');
  if (tp) tp.textContent = S.takePeak > 0 ? dbOf(S.takePeak).toFixed(1) + ' dBFS' : '--';
  if (S.phase === 'rec') {
    const t = (now - S.t0) / 1000, el = document.getElementById('clock');
    if (el) el.textContent = t.toFixed(1) + ' s';
    if (t > AUTO_STOP) { stop(); say(`Auto-stopped at ${AUTO_STOP} s.`, 'warn'); }
  }
  drawScope();
  drawRta();
}

// ---------------- record, keep, discard ----------------
const MIME = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', ''].find((m) => !m || MediaRecorder.isTypeSupported(m))!;
async function record() {
  if (S.phase === 'arming' || S.phase === 'rec' || S.phase === 'saving') return;
  const was = S.phase;
  S.phase = 'arming';
  try {
    if (!S.stream) await openMic(store.get('mic'));
    if (!S.stream) { if (S.phase === 'arming') S.phase = was === 'error' ? 'error' : 'idle'; return draw(); }
    if (actx?.state === 'suspended') await actx.resume();
    discard(true);
    S.kept = null;
    S.clipped = false;
    S.hot = false;
    S.clipLatch = false;
    S.takePeak = 0;
    S.chunks = [];
    const rec = (S.rec = new MediaRecorder(S.stream, { mimeType: MIME || undefined, audioBitsPerSecond: 256000 }));
    rec.ondataavailable = (e) => e.data.size && S.chunks.push(e.data);
    // the take is "recording" only once the recorder runs, so the red frame never lies about a cut first word
    rec.onstart = () => { S.t0 = performance.now(); S.phase = 'rec'; say(''); draw(); };
    rec.onstop = () => {
      if (S.phase === 'error') return; // the mic went away mid-take; nothing usable
      S.raw = new Blob(S.chunks, { type: rec.mimeType || MIME || 'audio/webm' });
      S.lastRaw = { cat: ALL[S.sel].cat, blob: S.raw };
      S.prevName = '';
      S.rawUrl = URL.createObjectURL(S.raw);
      S.phase = 'review';
      S.deck = 'review';
      if (S.tone !== 'warn') say('');
      say((S.msg ? S.msg + ' ' : '') + 'Raw take: Enter keeps it, Backspace throws it away, Space records it again.' +
        (S.clipped ? ' This take hit CLIP (-0.5 dBFS): unless that was only the key click, the booth will refuse it. Lower the mic level and record it again.'
          : S.hot ? ' Peaks went past -3 dBFS: usable, but back off a little.' : ''), S.clipped || S.hot || S.msg ? 'warn' : '');
      draw();
      (document.getElementById('rawplay') as HTMLAudioElement | null)?.play().catch(() => {});
    };
    rec.onerror = (e) => { S.phase = 'error'; say('Recorder error: ' + errText((e as any).error ?? e), 'err'); draw(); };
    rec.start();
    draw();
  } catch (e) {
    S.phase = 'error';
    say('Could not record: ' + errText(e), 'err');
    draw();
  }
}
function stop() {
  if (S.rec?.state === 'recording') S.rec.stop();
}
function discard(quiet = false) {
  const url = S.rawUrl;
  S.raw = null;
  S.rawUrl = '';
  // the raw player goes before its blob url is revoked, or it logs a failed load
  drawReview();
  if (url) URL.revokeObjectURL(url);
  if (!quiet) { S.phase = 'idle'; say('Discarded.'); draw(); }
}
async function keep() {
  const s = ALL[S.sel];
  if (!S.raw || S.phase !== 'review') return;
  S.phase = 'saving';
  say('Processing...');
  draw();
  try {
    const k = await api('POST', { cat: s.cat, slug: slugOf(s), ...(S.squeeze ? {} : { squeeze: '0' }), ...(fxOn(S.fx) ? { fx: JSON.stringify(S.fx) } : {}) }, S.raw);
    // the processed player's src is fixed here: a redraw must not restart it
    S.kept = { ...k, src: `${k.url}?t=${Date.now()}` };
    S.squeeze = sqDefault(s); // per take: the next one starts at the line's default again
    discard(true);
    S.phase = 'saved';
    S.deck = 'review';
    // the plugin's warnings: a quiet or hot input, and a take past its slot's length target + slots.ts LEN_SLACK (it
    // lands over the next moment: a kill word over the next fight)
    const sq = k.squeezed ? `, ${k.squeezed} s of pauses cut` : '';
    say(`Kept ${k.name}${k.fx ? ' with ' + k.fx : ''}: ${k.lufs} LUFS, peak ${k.peak} dBTP, ${k.dur?.toFixed?.(2)} s (gain ${k.gain > 0 ? '+' : ''}${k.gain} dB${sq}).` +
      (k.warn ? ' ' + k.warn + '.' : '') + (k.long ? ' ' + k.long + '.' : ''), k.warn || k.long ? 'warn' : '');
    await refreshTakes();
    (document.getElementById('keptplay') as HTMLAudioElement | null)?.play().catch(() => {});
  } catch (e) {
    // a clipped take: the plugin saved the raw and refused the keep; this one can only be recorded again
    if ((e as { clipped?: boolean }).clipped) {
      discard(true);
      S.phase = 'idle';
      say(`Not kept: ${errText(e)} (Space). Its raw take is saved in assets-raw/voice/${s.cat}/.`, 'err');
      await refreshTakes();
      return;
    }
    S.phase = 'review'; // the raw take is still here: try again or discard
    say('Keep failed: ' + errText(e), 'err');
    draw();
  }
}
/** re-runs the current chain on this line's kept raw takes (plugin.ts reprocess): each processed take is rewritten */
async function redo(apply = false) {
  const s = ALL[S.sel];
  if (S.phase === 'arming' || S.phase === 'rec' || S.phase === 'saving' || S.phase === 'review') return;
  const rack = fxName(S.fx) || 'no FX (clean)';
  if (!confirm(apply
    ? `Apply the current FX (${rack}) to every take of ${s.cat}/ that has a raw take? Each processed take is rewritten from its raw take with this rack, and remembers it. A raw take that clipped is skipped.`
    : `Reprocess every take of ${s.cat}/ that has a raw take, with the current chain? Each keeps the pause setting and FX it was ` +
    `kept with (takes from before that was saved: ${S.squeeze ? 'pauses shortened' : 'pauses kept'}, the checkbox). ` +
    'Each processed take is rewritten; a raw take that clipped is skipped.')) return;
  S.phase = 'saving';
  say('Reprocessing...');
  draw();
  try {
    const { takes } = await api('POST', { cat: s.cat, ...(S.squeeze ? {} : { squeeze: '0' }), ...(apply ? { fx: JSON.stringify(S.fx) } : {}) }, undefined, 'reprocess') as
      { takes: { name: string; done: boolean; why?: string; long?: string; warn?: string }[] };
    const done = takes.filter((t) => t.done), skip = takes.filter((t) => !t.done);
    const notes = [...done.filter((t) => t.long || t.warn).map((t) => `${t.name}: ${[t.long, t.warn].filter(Boolean).join('; ')}`),
      ...skip.map((t) => `${t.name} skipped: ${t.why}`)];
    S.phase = 'idle';
    S.kept = null;
    say(takes.length ? `Reprocessed ${done.length} of ${takes.length} take${takes.length === 1 ? '' : 's'}.` + (notes.length ? ' ' + notes.join(' / ') : '')
      : 'No raw takes for this line in assets-raw/voice/ (shipped clips have none).', skip.length || notes.length ? 'warn' : '');
  } catch (e) {
    S.phase = 'idle';
    say('Reprocess failed: ' + errText(e), 'err');
  }
  refreshTakes();
}
async function del(t: Take) {
  const s = ALL[S.sel];
  const where = t.raw ? `Its raw take stays in assets-raw/voice/${s.cat}/.` : 'It has no raw take here: if it is a shipped clip, git checkout restores it.';
  if (!confirm(`Delete ${t.name}? ${where}`)) return;
  try {
    await api('DELETE', { cat: s.cat, name: t.name });
    if (S.kept?.name === t.name && S.phase === 'saved') { S.kept = null; S.phase = 'idle'; }
    say('Deleted ' + t.name + '.');
  } catch (e) {
    say('Delete failed: ' + errText(e), 'err');
  }
  refreshTakes();
}
function move(d: number) {
  if (!d || S.phase === 'arming' || S.phase === 'rec' || S.phase === 'saving') return;
  if (S.phase === 'review') return void (say('Keep (Enter) or discard (Backspace) this take first.', 'warn'), draw());
  S.sel = (S.sel + d + ALL.length) % ALL.length;
  S.squeeze = sqDefault(ALL[S.sel]);
  S.prevName = '';
  dropPrev();
  store.set('slot', ALL[S.sel].cat);
  S.kept = null;
  if (S.phase !== 'error') { S.phase = 'idle'; say(''); } // a mic error stays up until a mic opens
  draw();
  document.querySelector('.slot.sel')?.scrollIntoView({ block: 'nearest' });
}
function testGame(s: Slot) {
  if (!s.test) return;
  // the take just kept, so the game plays that one and not the shuffle bag's next pick
  const clip = S.kept && S.phase === 'saved' ? '&clip=' + encodeURIComponent(S.kept.name.replace(/\.ogg$/, '')) : '';
  window.open('/?' + s.test + clip, 'grodius-booth-game');
}

// capture: runs before a focused <audio> or button acts on the key
const TYPING = ['text', 'search', 'file'];
addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement, k = e.key;
  // typing a quip's words, a preset name or an effect search: the keys are the box's (its own Enter acts)
  if (t.tagName === 'SELECT' || t.tagName === 'INPUT' && TYPING.includes((t as HTMLInputElement).type) || e.ctrlKey || e.metaKey || e.altKey) return;
  // a button reached with Tab works from the keyboard (Record is the booth's own key anyway)
  if (t.tagName === 'BUTTON' && t.id !== 'b-rec' && (k === 'Enter' || k === ' ')) return;
  // a focused FX slider keeps the arrows (fine-tuning a knob), everything else is the booth's
  if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range' && k.startsWith('Arrow')) return;
  const ours = [' ', 'Enter', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 't', 'T', 'p', 'P', 'k', 'K', 'b', 'B', '/'].includes(k);
  if (!ours) return;
  e.preventDefault();
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (e.repeat && !k.startsWith('Arrow')) return; // holding Space must not start and stop takes
  if (k === ' ') S.phase === 'rec' ? stop() : record();
  else if (k === 'Enter') keep();
  else if (k === 'Backspace') {
    if (S.phase === 'review') discard();
    else if (S.phase === 'saved' && S.kept) del({ name: S.kept.name, raw: true });
  } else if (k === 'ArrowDown' || k === 'ArrowRight') move(1);
  else if (k === 'ArrowUp' || k === 'ArrowLeft') move(-1);
  else if (k === 't' || k === 'T') testGame(ALL[S.sel]);
  else if (k === 'p' || k === 'P') preview();
  else if (k === 'k' || k === 'K') playPause();
  else if (k === 'b' || k === 'B') toggleAB();
  else if (k === '/') ($id('fx-search') as HTMLInputElement).focus();
}, true);

// ---------------- view ----------------
function draw() {
  const s = ALL[S.sel], P = S.phase, mid = S.text[s.cat]?.name, takes = S.takes[s.cat] ?? [];
  const nq = ALL.length - SLOTS.length;
  // a redraw rebuilds the text boxes: what is being typed (and the caret) survives it
  const typing = document.activeElement as HTMLInputElement | null, was = { new: (document.getElementById('q-new') as HTMLInputElement | null)?.value ?? '',
    text: (document.getElementById('q-text') as HTMLInputElement | null)?.dataset.cat === s.cat ? (document.getElementById('q-text') as HTMLInputElement).value : null, focus: typing?.id ?? '', a: typing?.selectionStart ?? null, b: typing?.selectionEnd ?? null };
  $id('slots').innerHTML = ALL.map((x, i) => {
    const n = (S.takes[x.cat] ?? []).length, err = S.text[x.cat]?.err, stale = (S.takes[x.cat] ?? []).filter((t) => t.was != null).length;
    // the Quips section: a heading before the first quip (or before the add box when there are none)
    const head = i === SLOTS.length ? quipHead() : '';
    return `${head}<div class="slot${x.quip ? ' quip' : ''}${i === S.sel ? ' sel' : ''}" role="option" aria-selected="${i === S.sel}" data-i="${i}">
      <div class="t">${esc(linesOf(x).join(' / ') || '?')}</div>
      <div class="m"><span>${esc(x.cat)}/</span><span>${n} take${n === 1 ? '' : 's'}</span>${stale ? `<span class="warn">${stale} stale</span>` : ''}
      <span class="tag ${x.wired ? 'w' : 'nw'}">${x.quip ? 'quip' : x.wired ? 'wired' : 'recorded, not wired'}</span><span>${esc(S.text[x.cat]?.tag ?? x.caller)}</span>${err ? `<span style="color:var(--red)">${esc(err)}</span>` : ''}</div>
    </div>`;
  }).join('') + (nq ? '' : quipHead()) + `<div class="qadd"><input type="text" id="q-new" maxlength="48" placeholder="NEW QUIP (/ splits two lines)" aria-label="new quip words" autocomplete="off" spellcheck="false">
      <button id="q-add">Add quip</button></div>`;
  ($id('mic') as HTMLSelectElement).disabled = P === 'rec' || P === 'arming';
  $id('stage').classList.toggle('rec', P === 'rec');
  // the game's own face and tag for a take of this slot (text.ts asks render/hype.ts voiceOf); a quip is SLAB's
  // (render/hype.ts SLAB_CAT, pinned by tests/unit/quips.test.ts), whose face the text frame never sees
  const g = s.quip ? { face: -1, tag: s.caller } : S.text[s.cat], tag = g?.tag ?? s.caller;
  const face = g?.tag && g.tag !== s.caller ? `<br><b class="warn">In game:</b> the comms window calls this ${esc(g.tag)}, not ${esc(s.caller)}.` : '';
  $id('view').innerHTML = `
    <div class="who">${faceImg(g?.face)}<div><div class="caller">${esc(tag)}</div>
      <div class="dir">${esc(DIRECTION[tag] ?? '')}${s.note ? ' <b>' + esc(s.note) + '</b>' : ''}</div></div></div>
    <div class="line">${linesOf(s).map(esc).join('<br>') || '?'}</div>
    ${s.quip ? `<div class="row qedit"><input type="text" id="q-text" data-cat="${esc(s.cat)}" maxlength="48" value="${esc(s.quip.text)}" aria-label="quip words" autocomplete="off" spellcheck="false">
      <button id="q-save">Save words <kbd>Enter</kbd></button><button id="q-del">Delete quip</button>
      <span class="state">the folder and take names stay <code>${esc(s.quip.id)}</code> when the words change</span></div>` : ''}
    <div class="when">${esc(s.when)}${mid ? ' &middot; ' + esc(mid) : ''} &middot; files as <code>src/sfx/${esc(s.cat)}/${esc(slugOf(s))}-matty-N.ogg</code>${s.maxLen ? ` &middot; <b>${s.maxLen} s or less</b>` : ''}
      ${s.wired ? '' : '<br><b class="warn">Recorded, not wired:</b> the game does not play this folder yet.'}${face}</div>
    <div class="row transport">
      <button id="b-rec" class="rec${P === 'rec' ? ' on' : ''}" ${P === 'saving' || P === 'arming' ? 'disabled' : ''}><span class="dot" aria-hidden="true"></span>${P === 'rec' ? 'Stop' : P === 'review' ? 'Record again' : 'Record'} <kbd>Space</kbd></button>
      <span class="lcd" id="clock" title="take length">${P === 'rec' ? '0.0 s' : '0.0 s'}</span>${P === 'rec' ? '<span class="recdot">REC</span><span class="state">let the last word ring out a beat before Stop</span>' : ''}
      ${s.test ? `<button id="b-test">Test in game <kbd>T</kbd></button>` : ''}
      <label class="opt" title="pauses inside the take longer than 0.4 s are cut to 0.25 s when it is kept"><input type="checkbox" id="b-sq"${S.squeeze ? ' checked' : ''}${P === 'rec' || P === 'saving' ? ' disabled' : ''}> shorten pauses over 0.4 s</label>
    </div>`;
  const st = $id('status');
  st.textContent = S.msg;
  st.className = 'state' + (S.tone ? ' ' + S.tone : '');
  st.style.color = S.tone === 'err' ? 'var(--red)' : S.tone === 'warn' ? 'var(--warn)' : '';
  $id('takes').innerHTML = `<h2>Takes in src/sfx/${esc(s.cat)}/ (${takes.length})</h2>
    ${takes.map((t, i) => `<div class="take"><audio controls preload="none" src="/src/sfx/${esc(s.cat)}/${esc(t.name)}"></audio><span>${esc(t.name)}</span>${t.fx ? `<span class="fxtag">${esc(t.fx)}</span>` : ''}${t.was != null ? `<span class="warn">stale: says ${esc(t.was)}</span>` : ''}
      ${t.raw ? `<button data-fxp="${i}" title="hear this take's raw recording through the current FX rack">FX preview</button>` : ''}
      ${/-matty-\d+\.ogg$/.test(t.name) ? `<button data-del="${i}">Delete</button>` : ''}</div>`).join('') || '<div class="state">None yet. The slab is empty.</div>'}
    ${takes.some((t) => t.raw) ? `<div class="row"><button id="b-redo" ${P === 'idle' || P === 'saved' || P === 'error' ? '' : 'disabled'}>Reprocess this line's takes</button>
      <button id="b-apply" ${P === 'idle' || P === 'saved' || P === 'error' ? '' : 'disabled'}>Apply current FX to this line's takes</button>
      <span class="state">re-runs the chain on the kept raw takes (no re-recording): each with its own FX, or all with the rack's</span></div>` : ''}
    <div class="keys"><kbd>Space</kbd> record / stop &middot; <kbd>Enter</kbd> keep &middot; <kbd>Backspace</kbd> discard (or delete the take just kept) &middot;
      <kbd>&uarr;</kbd><kbd>&darr;</kbd> line &middot; <kbd>P</kbd> FX preview &middot; <kbd>K</kbd> play / pause &middot; <kbd>B</kbd> A/B clean vs FX &middot;
      <kbd>/</kbd> search effects &middot; <kbd>T</kbd> test in game. Takes are mono 44.1 kHz Vorbis at -12 LUFS, the gaps between phrases turned down; the raw take stays in
      <code>assets-raw/voice/</code> (git-ignored). A take stops itself at ${AUTO_STOP} s.</div>`;
  document.querySelectorAll<HTMLElement>('.slot').forEach((el) => (el.onclick = () => move(+el.dataset.i! - S.sel)));
  document.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => (el.onclick = () => { el.blur(); del(takes[+el.dataset.del!]); }));
  document.querySelectorAll<HTMLElement>('[data-fxp]').forEach((el) => (el.onclick = () => { el.blur(); S.prevName = takes[+el.dataset.fxp!].name; preview(); }));
  on('b-rec', () => (S.phase === 'rec' ? stop() : record()));
  on('b-test', () => testGame(s));
  on('b-redo', () => redo());
  on('b-apply', () => redo(true));
  const qne = document.getElementById('q-new') as HTMLInputElement | null, qte = document.getElementById('q-text') as HTMLInputElement | null;
  if (qne) qne.value = was.new;
  if (qte && was.text != null) qte.value = was.text;
  if (was.focus === 'q-new' || was.focus === 'q-text') {
    const el = document.getElementById(was.focus) as HTMLInputElement | null;
    el?.focus();
    if (el && was.a != null) el.setSelectionRange(was.a, was.b ?? was.a); // the caret too, not just the focus
  }
  on('q-del', () => delQuip(s));
  on('q-save', () => editQuip(s, ($id('q-text') as HTMLInputElement).value));
  on('q-add', () => addQuip(($id('q-new') as HTMLInputElement).value));
  const qt = document.getElementById('q-text') as HTMLInputElement | null, qn = document.getElementById('q-new') as HTMLInputElement | null;
  // Escape drops the unsaved words: the box must never look saved when it isn't
  if (qt) qt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); editQuip(s, qt.value); } else if (e.key === 'Escape') { qt.value = s.quip!.text; qt.blur(); } };
  if (qn) qn.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addQuip(qn.value); } else if (e.key === 'Escape') qn.blur(); };
  const sqb = document.getElementById('b-sq') as HTMLInputElement | null;
  if (sqb) sqb.onchange = () => { S.squeeze = sqb.checked; sqb.blur(); };
  // the take decks and the rack's bar follow the take (recorded, kept, discarded, another line)
  drawReview();
  drawFxBar();
}
/** a click handler that gives the focus back to the booth's keys */
function on(id: string, f: () => void) {
  const b = document.getElementById(id);
  if (b) b.onclick = (e) => { (e.currentTarget as HTMLElement).blur(); f(); };
}
const fmt = (n: number | null | undefined, d = 1, u = '') => (n == null || !Number.isFinite(+n) ? '--' : (+n).toFixed(d) + u);
const chip = (k: string, v: string, cls = '') => `<span class="rd${cls ? ' ' + cls : ''}"><i>${k}</i>${esc(v)}</span>`;

// ---------------- the review deck: the raw take, then the processed one ----------------
let shownReview = '', reviewDisp: Disp | null = null;
/** rebuilt only when its take changes (a redraw must not restart the player); the buttons follow the phase */
function drawReview() {
  const el = $id('review'), P = S.phase;
  const key = S.rawUrl ? 'raw:' + S.rawUrl : S.kept && P === 'saved' ? 'kept:' + S.kept.src : '';
  if (key !== shownReview) {
    shownReview = key;
    reviewDisp?.destroy();
    reviewDisp = null;
    if (!key) el.innerHTML = '';
    else if (S.rawUrl) {
      el.innerHTML = `<div class="deck" data-deck="review"><div class="deckh"><span class="lane-tag">RAW TAKE</span>
          <button class="tp" id="rv-play" title="play / pause (K)">Play <kbd>K</kbd></button>
          <span class="reads" id="rv-read">${chip('DUR', '--')}${chip('PEAK', '--')}</span>
          <span class="grow"></span>
          <button id="b-keep">Keep <kbd>Enter</kbd></button><button id="b-drop">Discard <kbd>Backspace</kbd></button></div>
        <div class="wave" id="rv-wave"></div><audio id="rawplay" controls src="${S.rawUrl}"></audio></div>`;
    } else if (S.kept) {
      const k = S.kept;
      el.innerHTML = `<div class="deck" data-deck="review"><div class="deckh"><span class="lane-tag ok">KEPT</span>
          <button class="tp" id="rv-play" title="play / pause (K)">Play <kbd>K</kbd></button>
          <span class="reads">${chip('LUFS', fmt(k.lufs))}${chip('PEAK', fmt(k.peak, 1, ' dBTP'))}${chip('DUR', fmt(k.dur, 2, ' s'))}${chip('GAIN', (k.gain > 0 ? '+' : '') + k.gain + ' dB')}</span>
          <span class="grow"></span><button id="b-undo">Delete this take <kbd>Backspace</kbd></button></div>
        <div class="wave" id="rv-wave"></div><audio id="keptplay" controls src="${esc(k.src)}"></audio></div>`;
    }
    const media = el.querySelector('audio');
    if (media) {
      const box = $id('rv-wave'), raw = !!S.rawUrl;
      attach(box, media, media.src, { spectro: S.spectro, color: raw ? '#5f3a40' : '#2f5a3b', progress: raw ? '#e6dcdc' : '#6fd08c' }).then((d) => {
        if (!d) return;
        if (!box.isConnected) return d.destroy();
        reviewDisp = d;
        // the raw take's own numbers, from the decoded audio
        if (raw) d.ws.on('decode', (dur: number) => {
          const b = d.ws.getDecodedData();
          let p = 0;
          if (b) for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) p = Math.max(p, Math.abs(v));
          const r = document.getElementById('rv-read');
          if (r) r.innerHTML = chip('DUR', fmt(dur, 2, ' s')) + chip('PEAK', fmt(dbOf(p), 1, ' dBFS'), p >= CLIP ? 'bad' : p > HOT ? 'hot' : '');
        });
      });
      media.addEventListener('play', () => (S.deck = 'review'));
      playLabel(media, 'rv-play');
    }
  }
  const k = document.getElementById('b-keep') as HTMLButtonElement | null, d = document.getElementById('b-drop') as HTMLButtonElement | null;
  if (k) k.disabled = P !== 'review';
  if (d) d.disabled = P !== 'review';
  on('b-keep', keep);
  on('b-drop', () => discard());
  on('b-undo', () => S.kept && del({ name: S.kept.name, raw: true }));
  on('rv-play', () => { S.deck = 'review'; playPause(); });
}
/** a Play button that says Pause while its player runs */
function playLabel(media: HTMLAudioElement, id: string) {
  const f = () => { const b = document.getElementById(id); if (b) b.innerHTML = `${media.paused ? 'Play' : 'Pause'} <kbd>K</kbd>`; };
  media.addEventListener('play', f);
  media.addEventListener('pause', f);
  media.addEventListener('ended', f);
}
/** K: the deck last used. The FX deck plays A and B together, one of them muted */
function playPause() {
  const fx = document.getElementById('fxplay') as HTMLAudioElement | null;
  if (S.deck === 'fx' && fx) return fxPlayPause();
  const m = (document.getElementById('rawplay') ?? document.getElementById('keptplay')) as HTMLAudioElement | null;
  if (m) {
    m.paused ? m.play().catch(() => {}) : m.pause();
    // the other deck stops: one thing plays at a time
    if (!m.paused) fxPause();
  } else if (fx) fxPlayPause();
}

// ---------------- the FX rack (fx.ts) ----------------
/** the groups fx.ts names (GROUPS, Effect.group), or the booth's own until it does */
const LOCAL_GROUPS: readonly { id: string; label: string }[] = [
  { id: 'pitch', label: 'Pitch' }, { id: 'synth', label: 'Synth & vocoder' }, { id: 'space', label: 'Space' }, { id: 'mod', label: 'Modulation' },
  { id: 'dirt', label: 'Dirt' }, { id: 'tone', label: 'Tone & filter' }, { id: 'dynamics', label: 'Dynamics' }, { id: 'time', label: 'Time' }, { id: 'weird', label: 'Weird' },
];
/** the rack's first 16 effects, before fx.ts said their group */
const OLD_GROUP: Record<string, string> = {
  pitch: 'pitch', octave: 'pitch', robot: 'synth', whisper: 'synth', ring: 'synth', chop: 'mod', drive: 'dirt', crush: 'dirt',
  radio: 'tone', chorus: 'mod', flanger: 'mod', phaser: 'mod', vibrato: 'mod', tremolo: 'mod', echo: 'time', cave: 'space',
};
const groupOf = (e: Effect) => String((e as any).group ?? OLD_GROUP[e.id] ?? 'other');
const GROUPS: readonly { id: string; label: string }[] = (() => {
  const from = (FX as any).GROUPS as readonly { id: string; label: string }[] | undefined;
  const list = [...(Array.isArray(from) && from.length ? from : LOCAL_GROUPS)];
  for (const e of EFFECTS) if (!list.some((g) => g.id === groupOf(e))) list.push({ id: groupOf(e), label: groupOf(e) === 'other' ? 'Other' : groupOf(e) });
  return list.filter((g) => EFFECTS.some((e) => groupOf(e) === g.id));
})();
const HUE: Record<string, string> = { pitch: '#d0405e', synth: '#8a6cff', space: '#3fa7b5', mod: '#d0a13a', dirt: '#e8582d', tone: '#6fae5a', dynamics: '#b9b0b2', time: '#4f86d9', weird: '#d64fb0' };
const hueOf = (g: string) => HUE[g] ?? ['#c46a6a', '#7aa0a0', '#a08ac4', '#c4a46a'][[...g].reduce((a, c) => a + c.charCodeAt(0), 0) % 4];
const BY = new Map(EFFECTS.map((e) => [e.id, e]));
/** an effect's knob values: the rack's when it is on, else the ones it was left at, else the defaults */
const valOf = (id: string): Record<string, number> => S.fx[id] ?? S.knobs[id] ?? defaults(id);
/** what a preview plays: the rack, or the soloed effect alone */
const rackFx = (): FxSet => (S.solo ? cleanFx({ [S.solo]: valOf(S.solo) }) : S.fx);
const saveRack = () => { store.set('fx', JSON.stringify(S.fx)); store.set('fxknobs', JSON.stringify(S.knobs)); };

// ---- user presets: the browser's, exportable as JSON ----
type UserPreset = { name: string; fx: FxSet };
const loadUser = (): UserPreset[] => {
  try {
    const a = JSON.parse(store.get('presets') ?? '[]');
    return Array.isArray(a) ? a.filter((p) => p && typeof p.name === 'string' && p.name.trim()).map((p) => ({ name: p.name.trim().slice(0, 40), fx: cleanFx(p.fx) })) : [];
  } catch { return []; }
};
let USER: UserPreset[] = loadUser();
const saveUser = () => store.set('presets', JSON.stringify(USER));
/** the preset last picked or saved: it names the rack while the rack is still exactly it (one of yours can equal a
 *  factory one) */
let picked = '';
const fxOfPreset = (v: string) => (v.startsWith('f:') ? PRESETS[+v.slice(2)]?.fx : v.startsWith('u:') ? USER[+v.slice(2)]?.fx : undefined);
/** the preset the rack is exactly: 'f:<i>' a factory one, 'u:<i>' one of yours, '' custom */
function presetOf(): string {
  const cur = JSON.stringify(cleanFx(S.fx)), pf = fxOfPreset(picked);
  if (pf && JSON.stringify(cleanFx(pf)) === cur) return picked;
  const f = PRESETS.findIndex((p) => JSON.stringify(cleanFx(p.fx)) === cur);
  if (f >= 0) return 'f:' + f;
  const u = USER.findIndex((p) => JSON.stringify(p.fx) === cur);
  return u >= 0 ? 'u:' + u : '';
}
function drawPresets() {
  const sel = document.getElementById('fx-preset') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = `<option value="">custom</option><optgroup label="Factory" id="fx-factory">${PRESETS.map((p, i) => `<option value="f:${i}">${esc(p.name)}</option>`).join('')}</optgroup>` +
    (USER.length ? `<optgroup label="Yours" id="fx-yours">${USER.map((p, i) => `<option value="u:${i}">${esc(p.name)}</option>`).join('')}</optgroup>` : '');
  ($id('fx-export') as HTMLButtonElement).disabled = !USER.length;
}
function savePreset() {
  const box = $id('fx-pname') as HTMLInputElement, name = box.value.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) { say('Name the rack first (the box left of Save).', 'warn'); box.focus(); return draw(); }
  const i = USER.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
  if (i >= 0 && !confirm(`Replace your preset ${USER[i].name}?`)) return;
  const p = { name, fx: cleanFx(S.fx) };
  if (i >= 0) USER[i] = p; else USER.push(p);
  saveUser();
  picked = 'u:' + (i >= 0 ? i : USER.length - 1);
  box.value = '';
  box.blur();
  drawPresets();
  say(`Saved the rack as ${name}. It'll be back.`);
  draw();
}
function delPreset() {
  const v = presetOf();
  if (!v.startsWith('u:')) return;
  const p = USER[+v.slice(2)];
  if (!confirm(`Delete your preset ${p.name}? The rack stays as it is.`)) return;
  USER.splice(+v.slice(2), 1);
  picked = '';
  saveUser();
  drawPresets();
  say(`Deleted the preset ${p.name}.`);
  draw();
}
function exportPresets() {
  const blob = new Blob([JSON.stringify({ booth: 'grodius-fx-presets', v: 1, presets: USER }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grodius-booth-presets.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/** a file of presets: this booth's export, a bare list of { name, fx }, or one preset. Same name replaces */
async function importPresets(f: File) {
  try {
    const j = JSON.parse(await f.text());
    const list: unknown[] = Array.isArray(j) ? j : Array.isArray(j?.presets) ? j.presets : j?.fx ? [j] : [];
    let n = 0;
    for (const x of list as { name?: unknown; fx?: unknown }[]) {
      const name = typeof x?.name === 'string' ? x.name.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
      if (!name || !x.fx || typeof x.fx !== 'object') continue;
      const p = { name, fx: cleanFx(x.fx) }, i = USER.findIndex((u) => u.name.toLowerCase() === name.toLowerCase());
      if (i >= 0) USER[i] = p; else USER.push(p);
      n++;
    }
    if (!n) throw new Error('no presets in it');
    saveUser();
    drawPresets();
    say(`Imported ${n} preset${n === 1 ? '' : 's'} from ${f.name}.`);
  } catch (e) { say(`Import failed: ${errText(e)}.`, 'err'); }
  draw();
}

/** the rack's fixed frame, built once: the bars, the chain strip, the preview deck and the rack's box. drawRack()
 *  rebuilds only the cards (a preset, Randomize, an import), drawFxBar() the bits that follow the take and the rack */
function buildFx() {
  $id('fx').innerHTML = `<h2>FX rack <span class="state"></span></h2>
    <div class="row fxbar">
      <label class="opt">Preset <select id="fx-preset"></select></label>
      <input type="text" id="fx-pname" class="plain" maxlength="40" placeholder="name this rack" aria-label="preset name" autocomplete="off" spellcheck="false">
      <button id="fx-save" title="save the rack as one of your presets">Save</button>
      <button id="fx-del" title="delete the selected preset of yours" disabled>Delete</button>
      <button id="fx-export" title="download your presets as JSON">Export</button>
      <button id="fx-import" title="load presets from a JSON file">Import</button>
      <input type="file" id="fx-file" accept="application/json,.json" hidden>
    </div>
    <div class="row fxbar">
      <button id="fx-prev" class="hot" disabled>Preview <kbd>P</kbd></button>
      <label class="opt" title="re-render the preview whenever the rack changes"><input type="checkbox" id="fx-auto"${store.get('fxauto') !== '0' ? ' checked' : ''}> auto preview</label>
      <button id="fx-rand" title="2-5 random effects at random settings: roll the bones">Randomize</button>
      <button id="fx-off" title="every effect off (their settings are kept)">All off</button>
      <label class="opt" title="spectrograms under the waveforms"><input type="checkbox" id="fx-spec"${S.spectro ? ' checked' : ''}> spectrogram</label>
      <span class="state" id="fx-src"></span>
    </div>
    <div id="fx-chain" class="chain" aria-label="signal chain"></div>
    <div id="fx-out"></div>
    <div class="rackbar">
      <input type="search" id="fx-search" class="plain" placeholder="hunt an effect (/)" aria-label="search effects" autocomplete="off" spellcheck="false">
      <button id="fx-open" title="open every group">Expand all</button><button id="fx-shut" title="fold every group">Collapse all</button>
      <span class="state" id="fx-count"></span>
    </div>
    <div id="fx-rack"></div>`;
  drawPresets();
  const pre = $id('fx-preset') as HTMLSelectElement;
  pre.onchange = () => {
    const v = pre.value;
    pre.blur();
    if (!v) return;
    const fx = fxOfPreset(v);
    picked = v;
    if (fx) setFx(structuredClone(fx) as FxSet);
  };
  const nm = $id('fx-pname') as HTMLInputElement;
  nm.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); savePreset(); } else if (e.key === 'Escape') nm.blur(); };
  on('fx-save', savePreset);
  on('fx-del', delPreset);
  on('fx-export', exportPresets);
  on('fx-import', () => ($id('fx-file') as HTMLInputElement).click());
  const file = $id('fx-file') as HTMLInputElement;
  file.onchange = () => { const f = file.files?.[0]; file.value = ''; if (f) importPresets(f); };
  on('fx-rand', () => setFx(randomFx()));
  on('fx-off', () => setFx({}));
  on('fx-prev', () => preview());
  const auto = $id('fx-auto') as HTMLInputElement;
  auto.onchange = () => { store.set('fxauto', auto.checked ? '1' : '0'); auto.blur(); };
  const spec = $id('fx-spec') as HTMLInputElement;
  spec.onchange = () => {
    S.spectro = spec.checked;
    store.set('spectro', spec.checked ? '1' : '0');
    spec.blur();
    // both decks again, with or without
    shownReview = '';
    shownDeck = '';
    drawReview();
    drawDeck();
  };
  const q = $id('fx-search') as HTMLInputElement;
  q.oninput = () => { S.q = q.value; filterRack(); };
  q.onkeydown = (e) => {
    if (e.key === 'Escape') { q.value = ''; S.q = ''; filterRack(); q.blur(); } else if (e.key === 'Enter') { e.preventDefault(); q.blur(); }
  };
  on('fx-open', () => { S.shut.clear(); saveShut(); drawShut(); });
  on('fx-shut', () => { GROUPS.forEach((g) => S.shut.add(g.id)); saveShut(); drawShut(); });
  drawRack();
}
const saveShut = () => store.set('fxshut', JSON.stringify([...S.shut]));
const knobRow = (e: Effect, k: Knob, x: number) => `<label class="knob" title="double-click: back to ${esc(knobText(k, k.def))}"><span>${esc(k.label)}</span>
  <input type="range" data-e="${e.id}" data-k="${k.k}" min="${k.min}" max="${k.max}" step="${k.step}" value="${x}" aria-label="${esc(e.label + ' ' + k.label)}">
  <output id="o-${e.id}-${k.k}">${esc(knobText(k, x))}</output></label>`;
/** the cards, grouped. Rebuilt only when the rack changes shape (a preset, Randomize, an import): the knobs and the
 *  switches change in place, so a focused slider keeps its focus (and its arrows) through a preview */
function drawRack() {
  $id('fx-rack').innerHTML = GROUPS.map((g) => {
    const fx = EFFECTS.filter((e) => groupOf(e) === g.id);
    return `<section class="grp" data-g="${esc(g.id)}" style="--gc:${hueOf(g.id)}">
      <button class="grph" data-grp="${esc(g.id)}" aria-expanded="true"><span class="car" aria-hidden="true"></span>${esc(g.label)}<span class="gn" data-gn="${esc(g.id)}"></span></button>
      <div class="rack">${fx.map((e) => {
        const v = valOf(e.id), isOn = !!S.fx[e.id];
        return `<div class="fx${isOn ? ' on' : ''}" data-id="${e.id}" data-q="${esc((e.label + ' ' + e.blurb + ' ' + e.id + ' ' + g.label + ' ' + e.knobs.map((k) => k.label).join(' ')).toLowerCase())}">
          <div class="fxh"><label class="pw" title="on / bypass (its settings are kept)"><input type="checkbox" data-fx="${e.id}"${isOn ? ' checked' : ''}><span class="nm">${esc(e.label)}</span></label>
            <button class="mini" data-solo="${e.id}" aria-pressed="false" title="solo: preview this effect alone">S</button>
            <button class="mini" data-reset="${e.id}" title="reset its knobs to the defaults">R</button></div>
          <div class="blurb">${esc(e.blurb)}</div>
          ${e.knobs.map((k) => knobRow(e, k, v[k.k] ?? k.def)).join('')}</div>`;
      }).join('')}</div></section>`;
  }).join('');
  const el = $id('fx-rack');
  el.querySelectorAll<HTMLElement>('[data-grp]').forEach((b) => (b.onclick = () => {
    const g = b.dataset.grp!;
    S.shut.has(g) ? S.shut.delete(g) : S.shut.add(g);
    saveShut();
    drawShut();
  }));
  el.querySelectorAll<HTMLInputElement>('[data-fx]').forEach((c) => (c.onchange = () => {
    const id = c.dataset.fx!;
    if (c.checked) S.fx = cleanFx({ ...S.fx, [id]: valOf(id) });
    else { S.knobs = { ...S.knobs, [id]: S.fx[id] ?? valOf(id) }; const n = { ...S.fx }; delete n[id]; S.fx = n; }
    c.blur();
    saveRack();
    rackChanged();
  }));
  el.querySelectorAll<HTMLButtonElement>('[data-solo]').forEach((b) => (b.onclick = () => {
    b.blur();
    S.solo = S.solo === b.dataset.solo ? null : b.dataset.solo!;
    rackChanged();
  }));
  el.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach((b) => (b.onclick = () => {
    b.blur();
    const id = b.dataset.reset!;
    setKnobs(id, defaults(id));
    rackChanged(!!S.fx[id] || S.solo === id);
  }));
  el.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((r) => {
    r.oninput = () => setKnob(r.dataset.e!, r.dataset.k!, +r.value);
    // let go of the knob: the preview follows (the slider keeps focus, so the arrows can still nudge it)
    r.onchange = () => { if (S.fx[r.dataset.e!] || S.solo === r.dataset.e) autoPreview(); drawFxBar(); };
    // double-click: the knob's default
    r.ondblclick = () => {
      const k = BY.get(r.dataset.e!)?.knobs.find((x) => x.k === r.dataset.k);
      if (!k) return;
      r.value = String(k.def);
      setKnob(r.dataset.e!, k.k, k.def);
      r.onchange?.(new Event('change'));
    };
  });
  drawShut();
  filterRack();
  drawFxBar();
}
/** one knob moved: the rack (if the effect is on) and its remembered settings */
function setKnob(id: string, k: string, x: number) {
  const e = BY.get(id), knob = e?.knobs.find((y) => y.k === k);
  if (!e || !knob) return;
  const next = { ...valOf(id), [k]: x };
  S.knobs = { ...S.knobs, [id]: next };
  if (S.fx[id]) S.fx = { ...S.fx, [id]: next };
  const o = document.getElementById(`o-${id}-${k}`);
  if (o) o.textContent = knobText(knob, x);
  saveRack();
}
/** every knob of one effect, the sliders moved in place */
function setKnobs(id: string, v: Record<string, number>) {
  S.knobs = { ...S.knobs, [id]: v };
  if (S.fx[id]) S.fx = { ...S.fx, [id]: v };
  saveRack();
  for (const k of BY.get(id)?.knobs ?? []) {
    const r = document.querySelector<HTMLInputElement>(`#fx-rack input[data-e="${id}"][data-k="${k.k}"]`);
    if (r) r.value = String(v[k.k]);
    const o = document.getElementById(`o-${id}-${k.k}`);
    if (o) o.textContent = knobText(k, v[k.k]);
  }
}
/** a switch, a solo or a reset: the cards' lights, the counts, the chain, then the preview */
function rackChanged(again = true) {
  document.querySelectorAll<HTMLElement>('#fx-rack .fx').forEach((c) => {
    const id = c.dataset.id!;
    c.classList.toggle('on', !!S.fx[id]);
    c.classList.toggle('solo', S.solo === id);
    c.classList.toggle('muted', !!S.solo && S.solo !== id);
    const box = c.querySelector<HTMLInputElement>('[data-fx]');
    if (box) box.checked = !!S.fx[id];
    c.querySelector('[data-solo]')?.setAttribute('aria-pressed', String(S.solo === id));
  });
  drawFxBar();
  if (again) autoPreview();
}
function drawShut() {
  document.querySelectorAll<HTMLElement>('#fx-rack .grp').forEach((s) => {
    const shut = S.shut.has(s.dataset.g!) && !S.q;
    s.classList.toggle('shut', shut);
    s.querySelector('.grph')?.setAttribute('aria-expanded', String(!shut));
  });
}
/** the search box: cards whose name, blurb, group or knobs match every word; empty groups hide, matches unfold */
function filterRack() {
  const words = S.q.toLowerCase().split(/\s+/).filter(Boolean);
  let n = 0;
  document.querySelectorAll<HTMLElement>('#fx-rack .grp').forEach((s) => {
    let m = 0;
    s.querySelectorAll<HTMLElement>('.fx').forEach((c) => {
      const hit = words.every((w) => c.dataset.q!.includes(w));
      c.hidden = !hit;
      if (hit) m++;
    });
    s.hidden = !m;
    n += m;
  });
  $id('fx-count').textContent = words.length ? `${n} of ${EFFECTS.length} effects match` : `${EFFECTS.length} effects in ${GROUPS.length} groups`;
  drawShut();
}
/** the take the preview plays: a kept take picked with its FX preview button, the take in review, the last take
 *  recorded on this line, or nothing */
const lineRaw = () => (S.lastRaw && S.lastRaw.cat === ALL[S.sel].cat ? S.lastRaw.blob : null);
const fxSource = () => S.prevName ? S.prevName + ' (kept take)' : S.raw && S.phase === 'review' ? 'the take you just recorded' : lineRaw() ? 'your last take on this line' : '';
/** the rack's title, the preset box, the chain, the counts, the Preview button and the source: never the sliders.
 *  draw() calls it too, so the button and the source follow a take being recorded, kept or discarded */
function drawFxBar() {
  const sel = document.getElementById('fx-preset') as HTMLSelectElement | null;
  if (!sel) return;
  const preset = presetOf();
  sel.value = preset;
  sel.options[0].textContent = preset ? '' : 'custom';
  ($id('fx-del') as HTMLButtonElement).disabled = !preset.startsWith('u:');
  const h = document.querySelector('#fx h2 .state');
  if (h) h.textContent = fxOn(S.fx) ? fxName(S.fx) : 'off: takes are kept clean';
  const srcT = fxSource(), b = $id('fx-prev') as HTMLButtonElement;
  b.disabled = !srcT || S.prevBusy;
  b.innerHTML = `${S.prevBusy ? 'Rendering...' : 'Preview'} <kbd>P</kbd>`;
  $id('fx-src').textContent = srcT ? 'source: ' + srcT : 'record a take (or press FX preview on a kept take) to hear the rack';
  // the chain, in the order it runs
  const live = EFFECTS.filter((e) => S.fx[e.id]);
  $id('fx-chain').innerHTML = `<span class="io">MIC</span><span class="arr" aria-hidden="true"></span><span class="io">CLEANUP</span>` +
    live.map((e) => `<span class="arr" aria-hidden="true"></span><button class="link${S.solo && S.solo !== e.id ? ' muted' : ''}" data-goto="${e.id}" style="--gc:${hueOf(groupOf(e))}" title="${esc(e.blurb)}">${esc(e.label)}</button>`).join('') +
    (live.length ? '' : '<span class="arr" aria-hidden="true"></span><span class="io dim">no FX</span>') +
    `<span class="arr" aria-hidden="true"></span><span class="io">-12 LUFS</span><span class="arr" aria-hidden="true"></span><span class="io">LIMIT</span>` +
    (S.solo ? `<span class="solonote">SOLO ${esc(BY.get(S.solo)?.label ?? S.solo)}: previews play it alone; Keep uses the whole rack</span>` : '');
  $id('fx-chain').querySelectorAll<HTMLElement>('[data-goto]').forEach((x) => (x.onclick = () => { x.blur(); goTo(x.dataset.goto!); }));
  document.querySelectorAll<HTMLElement>('[data-gn]').forEach((x) => {
    const g = x.dataset.gn!, all = EFFECTS.filter((e) => groupOf(e) === g), n = all.filter((e) => S.fx[e.id]).length;
    x.textContent = n ? `${n} on / ${all.length}` : String(all.length);
    x.classList.toggle('lit', !!n);
  });
  drawDeck();
}
/** a chain link: its card, unfolded and found */
function goTo(id: string) {
  const c = document.querySelector<HTMLElement>(`#fx-rack .fx[data-id="${id}"]`);
  if (!c) return;
  if (c.hidden) { S.q = ''; ($id('fx-search') as HTMLInputElement).value = ''; filterRack(); }
  const g = c.closest<HTMLElement>('.grp')!.dataset.g!;
  if (S.shut.delete(g)) { saveShut(); drawShut(); }
  c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  c.classList.remove('flash');
  void c.offsetWidth;
  c.classList.add('flash');
}
const knobText = (k: { opts?: readonly string[]; unit?: string; step: number }, x: number) =>
  k.opts ? k.opts[Math.round(x)] ?? String(x) : (k.step < 1 ? (+x).toFixed(k.step < 0.1 ? 2 : k.step < 1 ? (String(k.step).split('.')[1]?.length ?? 1) : 0) : String(x)) + (k.unit ? ' ' + k.unit : '');
/** a whole new rack (a preset, Randomize, All off, a reload): its effects' settings are remembered too */
function setFx(fx: FxSet) {
  S.fx = cleanFx(fx);
  S.knobs = { ...S.knobs, ...S.fx };
  S.solo = null;
  saveRack();
  drawRack();
  autoPreview();
}

// ---------------- previews: rendered on the dev server, cached, played A/B ----------------
let fxTimer = 0, fxSeq = 0;
function autoPreview() {
  // nothing to play yet: a preset picked before the first take is not a mistake to warn about (the warning would
  // also be glued onto the next take's review message)
  if (store.get('fxauto') === '0' || !fxSource()) return;
  clearTimeout(fxTimer);
  fxTimer = setTimeout(preview, 250) as unknown as number;
}
/** renders by line, source, pause setting and rack: going back to a rack (or to the clean take) costs nothing */
const cache = new Map<string, Promise<Render>>();
const blobIds = new WeakMap<Blob, number>();
let blobN = 0;
const srcKey = (body: Blob | null) => (body ? 'b' + (blobIds.get(body) ?? (blobIds.set(body, ++blobN), blobN)) : 'take:' + S.prevName);
const inUse = (u: string) => S.prev?.url === u || S.prev?.clean?.url === u;
const drop = (p: Promise<Render>) => p.then((r) => { if (!inUse(r.url)) URL.revokeObjectURL(r.url); }, () => {});
function render(fx: FxSet, body: Blob | null): Promise<Render> {
  const s = ALL[S.sel], clean = cleanFx(fx), key = [s.cat, srcKey(body), S.squeeze ? 1 : 0, JSON.stringify(clean)].join('|');
  let p = cache.get(key);
  if (p) { cache.delete(key); cache.set(key, p); return p; } // most recent last
  p = (async () => {
    const q = new URLSearchParams({ cat: s.cat, fx: JSON.stringify(clean), ...(S.squeeze ? {} : { squeeze: '0' }), ...(S.prevName && !body ? { name: S.prevName } : {}) });
    const r = await fetch('/__booth/preview?' + q, { method: 'POST', body: body ?? undefined, headers: { 'x-booth': TOKEN, ...(body ? { 'content-type': body.type || 'audio/webm' } : {}) } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({ error: 'HTTP ' + r.status }))).error);
    const info = JSON.parse(decodeURIComponent(r.headers.get('x-booth-info') ?? '%7B%7D')) as Info;
    return { url: URL.createObjectURL(await r.blob()), info };
  })();
  cache.set(key, p);
  p.catch(() => cache.get(key) === p && cache.delete(key));
  while (cache.size > 24) {
    const [k, old] = cache.entries().next().value!;
    cache.delete(k);
    drop(old);
  }
  return p;
}
/** a line change: the last line's preview deck goes (and any render still on its way is ignored), then its renders */
function dropPrev() {
  fxSeq++;
  clearTimeout(fxTimer);
  S.prevBusy = false;
  S.prev = null;
  S.loop = null;
  S.solo = null;
  drawDeck();
  for (const p of cache.values()) drop(p);
  cache.clear();
}
/** the source through the chain and the rack on the dev server (POST /__booth/preview): nothing is written to src/.
 *  The clean render (no FX) of the same source comes with it, for the A/B */
async function preview() {
  clearTimeout(fxTimer); // P (or the button) while an auto preview waits: one render, not two
  const body = S.prevName ? null : S.phase === 'review' && S.raw ? S.raw : lineRaw();
  if (!S.prevName && !body) { say('Record a take first (or press FX preview on a kept take), then the rack has something to play.', 'warn'); return draw(); }
  const seq = ++fxSeq, pB = render(rackFx(), body), pA = render({}, body);
  S.prevBusy = true;
  drawFxBar();
  let ok = false;
  try {
    const b = await pB;
    if (seq !== fxSeq) return; // a newer preview is on its way
    S.prev = { url: b.url, info: b.info, clean: null };
    ok = true;
    drawDeck();
    pA.then((a) => { if (seq === fxSeq && S.prev?.url === b.url) { S.prev.clean = a; fillA(); } },
      (e) => { if (seq === fxSeq && S.prev?.url === b.url) { S.prev.cleanErr = errText(e); fillA(); } });
  } catch (e) {
    if (seq === fxSeq) { say('FX preview failed: ' + errText(e), 'err'); draw(); }
  } finally {
    if (seq === fxSeq) {
      S.prevBusy = false;
      drawFxBar();
      if (ok) { S.deck = 'fx'; fxStart(); }
    }
  }
}

/** the preview deck on screen (its B url): rebuilt only when the preview changes, or every draw would restart it */
let shownDeck = '', dispB: Disp | null = null, dispA: Disp | null = null;
const laneA = () => document.getElementById('cleanplay') as HTMLAudioElement | null;
const laneB = () => document.getElementById('fxplay') as HTMLAudioElement | null;
function drawDeck() {
  const key = S.prev?.url ?? '';
  if (key === shownDeck) return;
  shownDeck = key;
  dispA?.destroy();
  dispB?.destroy();
  dispA = dispB = null;
  const el = $id('fx-out'), p = S.prev;
  if (!p) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="deck ab" data-deck="fx">
    <div class="deckh"><span class="lane-tag">FX PREVIEW</span>
      <button class="tp" id="fx-play" title="play / pause A and B together (K)">Play <kbd>K</kbd></button>
      <span class="abs" role="group" aria-label="A/B"><button id="ab-a" title="hear the clean take (B toggles)">A clean</button><button id="ab-b" title="hear the rack (B toggles)">B FX</button></span>
      <span class="lcd" id="fx-time">0.00 s</span>
      <button id="fx-loop" title="drag across the FX waveform to loop a stretch; this clears it" hidden>Clear loop</button>
      <span class="state">drag on the FX waveform to loop a stretch</span></div>
    <div class="lane" id="lane-a"><button class="lt" id="lt-a" title="listen to A">A <b>CLEAN</b><span class="reads" id="read-a">${chip('', 'rendering...')}</span></button>
      <div class="wave" id="wave-a"></div><audio id="cleanplay" controls preload="auto"></audio></div>
    <div class="lane" id="lane-b"><button class="lt" id="lt-b" title="listen to B">B <b>FX</b><span class="reads" id="read-b">${reads(p.info)}</span></button>
      <div class="wave" id="wave-b"></div><audio id="fxplay" controls src="${p.url}"></audio></div>
    <div class="row"><span class="state">${esc(p.info.fx || 'clean')}${S.solo ? ' (solo)' : ''}</span>${p.info.warn ? `<span class="warn">${esc(p.info.warn)}</span>` : ''}</div>
  </div>`;
  const B = laneB()!;
  attach($id('wave-b'), B, p.url, { spectro: S.spectro, regions: true }).then((d) => {
    if (!d) return;
    if (!B.isConnected) return d.destroy();
    dispB = d;
    d.ws.on('interaction', (t: number) => { const A = laneA(); if (A?.src) A.currentTime = t; S.deck = 'fx'; });
    d.regions.enableDragSelection({ color: 'rgba(255, 74, 90, 0.16)' });
    const setLoop = (r: { start: number; end: number; id: string }) => {
      for (const x of d.regions.getRegions()) if (x.id !== r.id) x.remove();
      S.loop = r.end - r.start > 0.05 ? { start: r.start, end: r.end } : null;
      ($id('fx-loop') as HTMLElement).hidden = !S.loop;
    };
    d.regions.on('region-created', setLoop);
    d.regions.on('region-updated', setLoop);
    // the loop carries over to the next render of the same take
    d.ws.on('decode', (dur: number) => {
      if (S.loop && S.loop.start < dur) d.regions.addRegion({ start: S.loop.start, end: Math.min(S.loop.end, dur), color: 'rgba(255, 74, 90, 0.16)' });
    });
  });
  for (const m of [B, laneA()!]) m.addEventListener('play', () => (S.deck = 'fx'));
  playLabel(B, 'fx-play');
  on('fx-play', () => { S.deck = 'fx'; fxPlayPause(); });
  on('ab-a', () => toggleAB('A'));
  on('ab-b', () => toggleAB('B'));
  on('lt-a', () => toggleAB('A'));
  on('lt-b', () => toggleAB('B'));
  on('fx-loop', () => { S.loop = null; dispB?.regions?.clearRegions(); ($id('fx-loop') as HTMLElement).hidden = true; });
  abApply();
  if (p.clean || p.cleanErr) fillA();
}
const reads = (i: Info, gain?: number) => chip('LUFS', fmt(i.lufs)) + chip('PEAK', fmt(i.peak, 1, ' dBTP')) + chip('DUR', fmt(i.dur, 2, ' s')) +
  (gain ? chip('MATCH', (gain > 0 ? '+' : '') + gain.toFixed(1) + ' dB', 'dim') : '');
/** the clean render's lane, once it lands; the louder lane is turned down to the quieter, so A/B is loudness, not level */
function fillA() {
  const p = S.prev, A = laneA(), B = laneB();
  if (!p || !A || !B) return;
  const r = document.getElementById('read-a');
  if (!p.clean) { if (r) r.innerHTML = chip('', 'clean render failed: ' + (p.cleanErr ?? '?'), 'bad'); return; }
  if (A.getAttribute('src') === p.clean.url) return;
  A.src = p.clean.url;
  const la = p.clean.info.lufs, lb = p.info.lufs;
  let ga = 0, gb = 0;
  if (la != null && lb != null && Number.isFinite(la) && Number.isFinite(lb)) {
    const lo = Math.min(la, lb);
    ga = Math.max(-12, lo - la);
    gb = Math.max(-12, lo - lb);
  }
  A.volume = 10 ** (ga / 20);
  B.volume = 10 ** (gb / 20);
  if (r) r.innerHTML = reads(p.clean.info, ga);
  const rb = document.getElementById('read-b');
  if (rb) rb.innerHTML = reads(p.info, gb);
  attach($id('wave-a'), A, p.clean.url, { spectro: S.spectro, color: '#3d3a3b', progress: '#b9b0b2' }).then((d) => {
    if (!d) return;
    if (!A.isConnected) return d.destroy();
    dispA = d;
    d.ws.on('interaction', (t: number) => { const b = laneB(); if (b) b.currentTime = t; S.deck = 'fx'; });
  });
  // B already playing: A joins it where it is
  if (!B.paused) A.addEventListener('canplay', () => { if (!B.paused) { A.currentTime = B.currentTime; A.play().catch(() => {}); } }, { once: true });
  abApply();
}
/** A or B through, the other muted; both keep running, so a switch keeps the playhead */
function toggleAB(to?: 'A' | 'B') {
  S.ab = to ?? (S.ab === 'A' ? 'B' : 'A');
  S.deck = 'fx';
  abApply();
}
function abApply() {
  const A = laneA(), B = laneB();
  if (A) A.muted = S.ab !== 'A';
  if (B) B.muted = S.ab !== 'B';
  const deck = document.querySelector<HTMLElement>('.deck.ab');
  if (deck) deck.dataset.ab = S.ab;
  document.getElementById('ab-a')?.setAttribute('aria-pressed', String(S.ab === 'A'));
  document.getElementById('ab-b')?.setAttribute('aria-pressed', String(S.ab === 'B'));
}
const activeLane = () => (S.ab === 'A' && laneA()?.getAttribute('src') ? laneA() : laneB());
function fxStart(at?: number) {
  const A = laneA(), B = laneB();
  if (!B) return;
  // one thing plays at a time
  (document.getElementById('rawplay') as HTMLAudioElement | null)?.pause();
  (document.getElementById('keptplay') as HTMLAudioElement | null)?.pause();
  const t = at ?? S.loop?.start ?? 0;
  for (const m of [B, A]) {
    if (!m?.getAttribute('src')) continue;
    try { m.currentTime = t; } catch { /* not loaded yet */ }
    m.play().catch(() => {});
  }
}
function fxPause() { laneA()?.pause(); laneB()?.pause(); }
function fxPlayPause() {
  const act = activeLane();
  if (!act) return;
  if (!act.paused) return fxPause();
  const t = act.ended || (act.duration && act.currentTime >= act.duration - 0.02) ? undefined : act.currentTime;
  fxStart(S.loop && t != null && (t < S.loop.start || t >= S.loop.end) ? S.loop.start : t);
}
/** per frame: the clock, the loop, and the muted lane kept on the audible one's time */
function syncDeck() {
  const act = activeLane();
  if (!act) return;
  const A = laneA(), B = laneB(), other = act === A ? B : A, clock = document.getElementById('fx-time');
  if (clock) clock.textContent = `${act.currentTime.toFixed(2)} / ${Number.isFinite(act.duration) ? act.duration.toFixed(2) : '--'} s`;
  if (act.paused) return;
  if (S.loop && act.currentTime >= S.loop.end) return fxStart(S.loop.start);
  if (other?.getAttribute('src') && !other.paused && Number.isFinite(other.duration) && act.currentTime < other.duration && Math.abs(other.currentTime - act.currentTime) > 0.06) {
    other.currentTime = act.currentTime;
  }
}

/** the Quips section's heading in the line list */
function quipHead() {
  return `<div class="qhead">QUIPS <span>SLAB, after a midboss or boss kill (src/voice/quips.json)</span>${S.quipErr.length ? `<div class="err">quips.json: ${S.quipErr.map(esc).join('; ')}. Fix it by hand; the booth will not edit it until then.</div>` : ''}</div>`;
}

buildFx();
draw();
refreshQuips().then(refreshTakes);
meter();
openMic(store.get('mic'));
