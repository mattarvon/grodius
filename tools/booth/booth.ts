// The voice booth page (LS2-booth, tools/booth/README.md): pick a line, record it on the chosen mic, hear the raw take,
// keep it (the dev plugin processes it into src/sfx/<cat>/) or discard it, hear the processed take, and open the game
// at the moment that plays it. Imports only the leaf modules (slots, names); the words come from the game through the
// hidden text frame (text.ts).
import { SLOTS, type Slot } from './slots';
import { slugify } from './names';

const $id = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const store = {
  get: (k: string) => { try { return localStorage.getItem('booth.' + k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem('booth.' + k, v); } catch { /* private window */ } },
};

type Phase = 'idle' | 'rec' | 'review' | 'saving' | 'saved' | 'error';
const S = {
  sel: Math.max(0, SLOTS.findIndex((s) => s.cat === store.get('slot'))),
  phase: 'idle' as Phase,
  msg: '',
  text: {} as Record<string, { lines: string[]; name?: string; err?: string }>,
  takes: {} as Record<string, string[]>,
  stream: null as MediaStream | null,
  rec: null as MediaRecorder | null,
  chunks: [] as Blob[],
  raw: null as Blob | null,
  rawUrl: '',
  kept: null as null | { name: string; url: string; lufs: number; peak: number; dur: number; gain: number },
  t0: 0,
};

const linesOf = (s: Slot) => S.text[s.cat]?.lines?.length ? S.text[s.cat].lines : s.copy?.lines ?? [];
const slugOf = (s: Slot) => s.slug ?? slugify(linesOf(s).join(' '));

// ---------------- the game's words (text.ts posts them) ----------------
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin || ev.data?.booth !== 'text') return;
  S.text = ev.data.out;
  draw();
});

// ---------------- takes on disk ----------------
async function api(method: string, q: Record<string, string>, body?: Blob) {
  const r = await fetch('/__booth/' + (method === 'GET' ? 'takes' : 'take') + (Object.keys(q).length ? '?' + new URLSearchParams(q) : ''), {
    method, body, headers: method === 'GET' ? {} : { 'x-booth': '1', ...(body ? { 'content-type': body.type || 'audio/webm' } : {}) },
  });
  const j = await r.json().catch(() => ({ error: 'booth: ' + r.status }));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function refreshTakes() {
  try { S.takes = await api('GET', {}); } catch (e) { S.msg = String(e); }
  draw();
}

// ---------------- mic, meter ----------------
let actx: AudioContext | null = null, an: AnalyserNode | null = null, src: MediaStreamAudioSourceNode | null = null;
const buf = new Float32Array(2048);
let hold = 0;
async function openMic(id?: string | null) {
  S.stream?.getTracks().forEach((t) => t.stop());
  // the booth does its own cleanup (plugin.ts processTake): the browser's echo cancel, noise gate and AGC would pump
  // the level and smear the words before ffmpeg ever sees them
  const audio: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
  if (id) audio.deviceId = { exact: id };
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    if (id) return openMic(null); // the saved mic is unplugged: fall back to the default
    S.phase = 'error';
    S.msg = 'No mic: ' + (e as Error).message;
    return draw();
  }
  actx ||= new AudioContext();
  src?.disconnect();
  src = actx.createMediaStreamSource(S.stream);
  an = actx.createAnalyser();
  an.fftSize = 2048;
  src.connect(an);
  await listMics();
}
async function listMics() {
  const sel = $id('mic') as HTMLSelectElement;
  const cur = S.stream?.getAudioTracks()[0]?.getSettings().deviceId;
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  sel.innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? ' selected' : ''}>${esc(d.label || 'mic ' + (i + 1))}</option>`).join('');
}
($id('mic') as HTMLSelectElement).onchange = (e) => {
  const v = (e.target as HTMLSelectElement).value;
  store.set('mic', v);
  openMic(v);
};
navigator.mediaDevices?.addEventListener?.('devicechange', () => listMics());
function meter() {
  requestAnimationFrame(meter);
  if (!an) return;
  an.getFloatTimeDomainData(buf);
  let p = 0;
  for (const v of buf) p = Math.max(p, Math.abs(v));
  hold = Math.max(p, hold * .96);
  const db = p > 0 ? 20 * Math.log10(p) : -Infinity;
  ($id('lvl') as HTMLElement).style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
  $id('pk').textContent = (hold > 0 ? (20 * Math.log10(hold)).toFixed(1) : '-inf') + ' dB';
  $id('pk').style.color = hold > .97 ? 'var(--red)' : '';
  if (S.phase === 'rec') { const el = document.getElementById('clock'); if (el) el.textContent = ((performance.now() - S.t0) / 1000).toFixed(1) + ' s'; }
}

// ---------------- record, keep, discard ----------------
const MIME = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', ''].find((m) => !m || MediaRecorder.isTypeSupported(m))!;
async function record() {
  if (!S.stream) await openMic(store.get('mic'));
  if (!S.stream) return;
  if (actx?.state === 'suspended') await actx.resume();
  discard(true);
  S.chunks = [];
  S.rec = new MediaRecorder(S.stream, { mimeType: MIME || undefined, audioBitsPerSecond: 256000 });
  S.rec.ondataavailable = (e) => e.data.size && S.chunks.push(e.data);
  S.rec.onstop = () => {
    S.raw = new Blob(S.chunks, { type: S.rec?.mimeType || MIME || 'audio/webm' });
    S.rawUrl = URL.createObjectURL(S.raw);
    S.phase = 'review';
    S.msg = 'Raw take. Enter keeps it, Backspace throws it away.';
    draw();
    (document.getElementById('rawplay') as HTMLAudioElement | null)?.play().catch(() => {});
  };
  S.rec.start();
  S.t0 = performance.now();
  S.phase = 'rec';
  S.msg = '';
  draw();
}
function stop() {
  if (S.rec?.state === 'recording') S.rec.stop();
}
function discard(quiet = false) {
  if (S.rawUrl) URL.revokeObjectURL(S.rawUrl);
  S.raw = null;
  S.rawUrl = '';
  if (!quiet) { S.phase = 'idle'; S.msg = 'Discarded.'; draw(); }
}
async function keep() {
  const s = SLOTS[S.sel];
  if (!S.raw || S.phase !== 'review') return;
  S.phase = 'saving';
  S.msg = 'Processing...';
  draw();
  try {
    S.kept = await api('POST', { cat: s.cat, slug: slugOf(s) }, S.raw);
    discard(true);
    S.phase = 'saved';
    const k = S.kept!;
    S.msg = `Kept ${k.name}: ${k.lufs} LUFS, peak ${k.peak} dBFS, ${k.dur?.toFixed?.(2)} s (gain ${k.gain > 0 ? '+' : ''}${k.gain} dB).`;
    await refreshTakes();
    (document.getElementById('keptplay') as HTMLAudioElement | null)?.play().catch(() => {});
  } catch (e) {
    S.phase = 'review'; // the raw take is still here: try again or discard
    S.msg = String((e as Error).message);
    draw();
  }
}
async function del(name: string) {
  const s = SLOTS[S.sel];
  if (!confirm(`Delete ${name}? The raw take stays in assets-raw/voice/${s.cat}/.`)) return;
  try { await api('DELETE', { cat: s.cat, name }); } catch (e) { S.msg = String(e); }
  if (S.kept?.name === name) { S.kept = null; S.phase = 'idle'; }
  refreshTakes();
}
function move(d: number) {
  if (S.phase === 'rec' || S.phase === 'saving') return;
  S.sel = (S.sel + d + SLOTS.length) % SLOTS.length;
  store.set('slot', SLOTS[S.sel].cat);
  discard(true);
  S.kept = null;
  S.phase = 'idle';
  S.msg = '';
  draw();
  document.querySelector('.slot.sel')?.scrollIntoView({ block: 'nearest' });
}
const testGame = (s: Slot) => s.test && window.open('/?' + s.test, 'grodius-booth-game');

addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); S.phase === 'rec' ? stop() : S.phase !== 'saving' && record(); }
  else if (k === 'Enter') { e.preventDefault(); keep(); }
  else if (k === 'Backspace') { e.preventDefault(); if (S.phase === 'review') discard(); }
  else if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); move(1); }
  else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); move(-1); }
});

// ---------------- view ----------------
function draw() {
  $id('slots').innerHTML = SLOTS.map((s, i) => {
    const n = (S.takes[s.cat] ?? []).length, err = S.text[s.cat]?.err;
    return `<div class="slot${i === S.sel ? ' sel' : ''}" data-i="${i}">
      <div class="t">${esc(linesOf(s).join(' / ') || '?')}</div>
      <div class="m"><span>${esc(s.cat)}/</span><span>${n} take${n === 1 ? '' : 's'}</span>
      <span class="tag ${s.wired ? 'w' : 'nw'}">${s.wired ? 'wired' : 'recorded, not wired'}</span><span>${esc(s.caller)}</span>${err ? `<span style="color:var(--red)">${esc(err)}</span>` : ''}</div>
    </div>`;
  }).join('');
  const s = SLOTS[S.sel], P = S.phase, mid = S.text[s.cat]?.name;
  const takes = S.takes[s.cat] ?? [];
  $id('stage').innerHTML = `
    <div class="caller">${esc(s.caller)}</div>
    <div class="line">${linesOf(s).map(esc).join('<br>') || '?'}</div>
    <div class="when">${esc(s.when)}${mid ? ' &middot; ' + esc(mid) : ''} &middot; files as <code>src/sfx/${esc(s.cat)}/${esc(slugOf(s))}-matty-N.ogg</code>
      ${s.wired ? '' : '<br><b style="color:var(--warn)">Recorded, not wired:</b> the game does not play this folder yet.'}</div>
    <div class="row">
      <button id="b-rec" class="rec${P === 'rec' ? ' on' : ''}" ${P === 'saving' ? 'disabled' : ''}>${P === 'rec' ? 'Stop' : 'Record'} <kbd>Space</kbd></button>
      <span class="state" id="clock">${P === 'rec' ? '0.0 s' : ''}</span>
      ${s.test ? `<button id="b-test">Test in game</button>` : ''}
    </div>
    ${S.rawUrl ? `<div class="row"><audio id="rawplay" controls src="${S.rawUrl}"></audio>
      <button id="b-keep" ${P !== 'review' ? 'disabled' : ''}>Keep <kbd>Enter</kbd></button>
      <button id="b-drop" ${P !== 'review' ? 'disabled' : ''}>Discard <kbd>Backspace</kbd></button></div>` : ''}
    ${S.kept && P === 'saved' ? `<div class="row"><span class="state">Processed:</span><audio id="keptplay" controls src="${esc(S.kept.url)}?t=${Date.now()}"></audio></div>` : ''}
    <div class="state${P === 'error' ? ' err' : ''}">${esc(S.msg)}</div>
    <h2>Takes in src/sfx/${esc(s.cat)}/ (${takes.length})</h2>
    ${takes.map((f) => `<div class="take"><audio controls preload="none" src="/src/sfx/${esc(s.cat)}/${esc(f)}"></audio><span>${esc(f)}</span>
      ${/-matty-\d+\.ogg$/.test(f) ? `<button data-del="${esc(f)}">Delete</button>` : ''}</div>`).join('') || '<div class="state">None yet.</div>'}
    <div class="keys"><kbd>Space</kbd> record / stop &middot; <kbd>Enter</kbd> keep &middot; <kbd>Backspace</kbd> discard &middot; <kbd>&uarr;</kbd><kbd>&darr;</kbd> line.
      Takes are mono 44.1 kHz Vorbis at -12 LUFS; the raw take stays in <code>assets-raw/voice/</code> (git-ignored).</div>`;
  document.querySelectorAll<HTMLElement>('.slot').forEach((el) => (el.onclick = () => move(+el.dataset.i! - S.sel)));
  document.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => (el.onclick = () => del(el.dataset.del!)));
  const on = (id: string, f: () => void) => { const b = document.getElementById(id); if (b) b.onclick = (e) => { (e.currentTarget as HTMLElement).blur(); f(); }; };
  on('b-rec', () => (S.phase === 'rec' ? stop() : record()));
  on('b-keep', keep);
  on('b-drop', () => discard());
  on('b-test', () => testGame(s));
}

draw();
refreshTakes();
meter();
openMic(store.get('mic'));
