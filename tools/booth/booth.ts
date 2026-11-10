// The voice booth page (LS2-booth, tools/booth/README.md): pick a line, record it on the chosen mic, hear the raw take,
// keep it (the dev plugin processes it into src/sfx/<cat>/) or discard it, hear the processed take, and open the game
// at the moment that plays it. Imports only the leaf modules (slots, names) and no CSS: anything that pulls in the
// Vite client would make every keep reload this page (tests/unit/booth.test.ts pins it). The words come from the
// game through the hidden text frame (text.ts).
import { DIRECTION, SLOTS, quipSlot, type Slot } from './slots';
import { slugify } from './names';
import { normText, quipLines, textError, type Quip } from '../../src/voice/quiplist';

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
type Take = { name: string; raw: boolean; was?: string };
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
};
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
  } catch (e) { say('Add failed: ' + errText(e), 'err'); }
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
    say(`Saved: ${text}.` + (takes.length ? ' Its older takes are marked stale.' : ''));
  } catch (e) { say('Save failed: ' + errText(e), 'err'); }
  await refreshTakes();
}
async function delQuip(s: Slot) {
  if (!s.quip || busy()) return;
  const n = (S.takes[s.cat] ?? []).length;
  if (!confirm(n ? `Delete the quip ${s.quip.text} AND its ${n} take${n === 1 ? '' : 's'} in src/sfx/${s.cat}/? Raw takes stay in assets-raw/voice/${s.cat}/.` : `Delete the quip ${s.quip.text}?`)) return;
  try {
    setQuips((await quipOp({ op: 'del', id: s.quip.id, ...(n ? { takes: true } : {}) })).quips, S.quipErr, '');
    store.set('slot', ALL[S.sel].cat);
    S.kept = null;
    S.phase = 'idle';
    say(`Deleted ${s.quip.text}${n ? ` and its ${n} take${n === 1 ? '' : 's'}` : ''}.`);
  } catch (e) { say('Delete failed: ' + errText(e), 'err'); }
  await refreshTakes();
}

// ---------------- mic, meter ----------------
let actx: AudioContext | null = null, an: AnalyserNode | null = null, src: MediaStreamAudioSourceNode | null = null;
const buf = new Float32Array(2048);
let hold = 0, clipUntil = 0, hotUntil = 0, opening: Promise<void> | null = null;
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
function meter() {
  requestAnimationFrame(meter);
  $id('hint').textContent = actx?.state === 'suspended' ? 'click anywhere to start the meter' : '';
  if (!an) return;
  const now = performance.now();
  an.getFloatTimeDomainData(buf);
  let p = 0;
  for (const v of buf) p = Math.max(p, Math.abs(v));
  hold = Math.max(p, hold * .96);
  if (p >= CLIP) { clipUntil = now + 1500; if (S.phase === 'rec') S.clipped = true; }
  if (p > HOT) { hotUntil = now + 1500; if (S.phase === 'rec') S.hot = true; }
  const db = p > 0 ? 20 * Math.log10(p) : -Infinity;
  ($id('lvl') as HTMLElement).style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
  $id('pk').textContent = (hold > 0 ? (20 * Math.log10(hold)).toFixed(1) : '-inf') + ' dB';
  $id('clip').classList.toggle('on', now < clipUntil);
  $id('hot').classList.toggle('on', now < hotUntil && now >= clipUntil);
  if (S.phase === 'rec') {
    const t = (now - S.t0) / 1000, el = document.getElementById('clock');
    if (el) el.textContent = t.toFixed(1) + ' s';
    if (t > AUTO_STOP) { stop(); say(`Auto-stopped at ${AUTO_STOP} s.`, 'warn'); }
  }
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
    S.chunks = [];
    const rec = (S.rec = new MediaRecorder(S.stream, { mimeType: MIME || undefined, audioBitsPerSecond: 256000 }));
    rec.ondataavailable = (e) => e.data.size && S.chunks.push(e.data);
    // the take is "recording" only once the recorder runs, so the red frame never lies about a cut first word
    rec.onstart = () => { S.t0 = performance.now(); S.phase = 'rec'; say(''); draw(); };
    rec.onstop = () => {
      if (S.phase === 'error') return; // the mic went away mid-take; nothing usable
      S.raw = new Blob(S.chunks, { type: rec.mimeType || MIME || 'audio/webm' });
      S.rawUrl = URL.createObjectURL(S.raw);
      S.phase = 'review';
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
  if (S.rawUrl) URL.revokeObjectURL(S.rawUrl);
  S.raw = null;
  S.rawUrl = '';
  if (!quiet) { S.phase = 'idle'; say('Discarded.'); draw(); }
}
async function keep() {
  const s = ALL[S.sel];
  if (!S.raw || S.phase !== 'review') return;
  S.phase = 'saving';
  say('Processing...');
  draw();
  try {
    const k = await api('POST', { cat: s.cat, slug: slugOf(s), ...(S.squeeze ? {} : { squeeze: '0' }) }, S.raw);
    // the processed player's src is fixed here: a redraw must not restart it
    S.kept = { ...k, src: `${k.url}?t=${Date.now()}` };
    S.squeeze = sqDefault(s); // per take: the next one starts at the line's default again
    discard(true);
    S.phase = 'saved';
    // the plugin's warnings: a quiet or hot input, and a take past its slot's length target + slots.ts LEN_SLACK (it
    // lands over the next moment: a kill word over the next fight)
    const sq = k.squeezed ? `, ${k.squeezed} s of pauses cut` : '';
    say(`Kept ${k.name}: ${k.lufs} LUFS, peak ${k.peak} dBTP, ${k.dur?.toFixed?.(2)} s (gain ${k.gain > 0 ? '+' : ''}${k.gain} dB${sq}).` +
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
async function redo() {
  const s = ALL[S.sel];
  if (S.phase === 'arming' || S.phase === 'rec' || S.phase === 'saving' || S.phase === 'review') return;
  if (!confirm(`Reprocess every take of ${s.cat}/ that has a raw take, with the current chain? Each keeps the pause setting it was ` +
    `kept with (takes from before that was saved: ${S.squeeze ? 'pauses shortened' : 'pauses kept'}, the checkbox). ` +
    'Each processed take is rewritten; a raw take that clipped is skipped.')) return;
  S.phase = 'saving';
  say('Reprocessing...');
  draw();
  try {
    const { takes } = await api('POST', { cat: s.cat, ...(S.squeeze ? {} : { squeeze: '0' }) }, undefined, 'reprocess') as
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
addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement, k = e.key;
  // typing a quip's words: the keys are the text box's (its own Enter saves)
  if (t.tagName === 'SELECT' || t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text' || e.ctrlKey || e.metaKey || e.altKey) return;
  // a button reached with Tab works from the keyboard (Record is the booth's own key anyway)
  if (t.tagName === 'BUTTON' && t.id !== 'b-rec' && (k === 'Enter' || k === ' ')) return;
  const ours = [' ', 'Enter', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 't', 'T'].includes(k);
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
}, true);

// ---------------- view ----------------
function draw() {
  const s = ALL[S.sel], P = S.phase, mid = S.text[s.cat]?.name, takes = S.takes[s.cat] ?? [];
  const nq = ALL.length - SLOTS.length;
  // a redraw rebuilds the text boxes: what is being typed (and the caret) survives it
  const typing = document.activeElement as HTMLInputElement | null, was = { new: (document.getElementById('q-new') as HTMLInputElement | null)?.value ?? '',
    text: (document.getElementById('q-text') as HTMLInputElement | null)?.dataset.cat === s.cat ? (document.getElementById('q-text') as HTMLInputElement).value : null, focus: typing?.id ?? '' };
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
    <div class="row">
      <button id="b-rec" class="rec${P === 'rec' ? ' on' : ''}" ${P === 'saving' || P === 'arming' ? 'disabled' : ''}>${P === 'rec' ? 'Stop' : P === 'review' ? 'Record again' : 'Record'} <kbd>Space</kbd></button>
      <span class="state" id="clock">${P === 'rec' ? '0.0 s' : ''}</span>${P === 'rec' ? '<span class="recdot">&#9679; REC</span><span class="state">let the last word ring out a beat before Stop</span>' : ''}
      ${s.test ? `<button id="b-test">Test in game <kbd>T</kbd></button>` : ''}
      <label class="opt" title="pauses inside the take longer than 0.4 s are cut to 0.25 s when it is kept"><input type="checkbox" id="b-sq"${S.squeeze ? ' checked' : ''}${P === 'rec' || P === 'saving' ? ' disabled' : ''}> shorten pauses over 0.4 s</label>
    </div>
    ${S.rawUrl ? `<div class="row"><span class="state">Raw:</span><audio id="rawplay" controls src="${S.rawUrl}"></audio>
      <button id="b-keep" ${P !== 'review' ? 'disabled' : ''}>Keep <kbd>Enter</kbd></button>
      <button id="b-drop" ${P !== 'review' ? 'disabled' : ''}>Discard <kbd>Backspace</kbd></button></div>` : ''}
    ${S.kept && P === 'saved' ? `<div class="row"><span class="state">Processed:</span><audio id="keptplay" controls src="${esc(S.kept.src)}"></audio>
      <button id="b-undo">Delete this take <kbd>Backspace</kbd></button></div>` : ''}`;
  const st = $id('status');
  st.textContent = S.msg;
  st.className = 'state' + (S.tone ? ' ' + S.tone : '');
  st.style.color = S.tone === 'err' ? 'var(--red)' : S.tone === 'warn' ? 'var(--warn)' : '';
  $id('takes').innerHTML = `<h2>Takes in src/sfx/${esc(s.cat)}/ (${takes.length})</h2>
    ${takes.map((t, i) => `<div class="take"><audio controls preload="none" src="/src/sfx/${esc(s.cat)}/${esc(t.name)}"></audio><span>${esc(t.name)}</span>${t.was != null ? `<span class="warn">stale: says ${esc(t.was)}</span>` : ''}
      ${/-matty-\d+\.ogg$/.test(t.name) ? `<button data-del="${i}">Delete</button>` : ''}</div>`).join('') || '<div class="state">None yet.</div>'}
    ${takes.some((t) => t.raw) ? `<div class="row"><button id="b-redo" ${P === 'idle' || P === 'saved' || P === 'error' ? '' : 'disabled'}>Reprocess this line's takes</button>
      <span class="state">re-runs the current chain on the kept raw takes (no re-recording)</span></div>` : ''}
    <div class="keys"><kbd>Space</kbd> record / stop &middot; <kbd>Enter</kbd> keep &middot; <kbd>Backspace</kbd> discard (or delete the take just kept) &middot;
      <kbd>&uarr;</kbd><kbd>&darr;</kbd> line &middot; <kbd>T</kbd> test in game. Takes are mono 44.1 kHz Vorbis at -12 LUFS, the gaps between phrases turned down; the raw take stays in
      <code>assets-raw/voice/</code> (git-ignored). A take stops itself at ${AUTO_STOP} s.</div>`;
  document.querySelectorAll<HTMLElement>('.slot').forEach((el) => (el.onclick = () => move(+el.dataset.i! - S.sel)));
  document.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => (el.onclick = () => { el.blur(); del(takes[+el.dataset.del!]); }));
  const on = (id: string, f: () => void) => { const b = document.getElementById(id); if (b) b.onclick = (e) => { (e.currentTarget as HTMLElement).blur(); f(); }; };
  on('b-rec', () => (S.phase === 'rec' ? stop() : record()));
  on('b-keep', keep);
  on('b-drop', () => discard());
  on('b-undo', () => S.kept && del({ name: S.kept.name, raw: true }));
  on('b-test', () => testGame(s));
  on('b-redo', redo);
  const qne = document.getElementById('q-new') as HTMLInputElement | null, qte = document.getElementById('q-text') as HTMLInputElement | null;
  if (qne) qne.value = was.new;
  if (qte && was.text != null) qte.value = was.text;
  if (was.focus === 'q-new' || was.focus === 'q-text') document.getElementById(was.focus)?.focus();
  on('q-del', () => delQuip(s));
  on('q-save', () => editQuip(s, ($id('q-text') as HTMLInputElement).value));
  on('q-add', () => addQuip(($id('q-new') as HTMLInputElement).value));
  const qt = document.getElementById('q-text') as HTMLInputElement | null, qn = document.getElementById('q-new') as HTMLInputElement | null;
  if (qt) qt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); editQuip(s, qt.value); } else if (e.key === 'Escape') qt.blur(); };
  if (qn) qn.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addQuip(qn.value); } else if (e.key === 'Escape') qn.blur(); };
  const sqb = document.getElementById('b-sq') as HTMLInputElement | null;
  if (sqb) sqb.onchange = () => { S.squeeze = sqb.checked; sqb.blur(); };
}

/** the Quips section's heading in the line list */
function quipHead() {
  return `<div class="qhead">QUIPS <span>SLAB, after a midboss or boss kill (src/voice/quips.json)</span>${S.quipErr.length ? `<div class="err">quips.json: ${S.quipErr.map(esc).join('; ')}. Fix it by hand; the booth will not edit it until then.</div>` : ''}</div>`;
}

draw();
refreshQuips().then(refreshTakes);
meter();
openMic(store.get('mic'));
