// @ts-nocheck
// Perf meter, off unless the URL has ?perf. Times the phases of each frame (step, world, fx, hud, present) with
// performance.now() and keeps a rolling window, plus real rAF frame intervals. Shown as a small readout on the
// display canvas; window.__perf() returns the numbers (tools / Chrome console).
export const PERF = typeof location !== 'undefined' && /[?&]perf\b/.test(location.search);
const N = 240, ring = {}, cur = {};
let t0 = 0, lastFrame = 0;
function push(k, v) {
  const r = (ring[k] ||= { a: new Float32Array(N), i: 0, n: 0 });
  r.a[r.i] = v;
  r.i = (r.i + 1) % N;
  r.n = Math.min(N, r.n + 1);
}
/** start timing a phase */
export function pIn() { if (PERF) t0 = performance.now(); }
/** end the phase started by pIn() under name k (several pIn/pOut pairs per frame add up) */
export function pOut(k) { if (PERF) cur[k] = (cur[k] || 0) + performance.now() - t0; }
/** close the frame: commit this frame's phase totals and the interval since the last frame */
export function pFrame() {
  if (!PERF) return;
  const now = performance.now();
  if (lastFrame) push('frame', now - lastFrame);
  lastFrame = now;
  for (const k in cur) { push(k, cur[k]); cur[k] = 0; }
}
function stats(k) {
  const r = ring[k];
  if (!r || !r.n) return null;
  const a = Array.from(r.a.slice(0, r.n)).sort((x, y) => x - y);
  return { avg: a.reduce((s, v) => s + v, 0) / a.length, p95: a[Math.floor(a.length * .95)], max: a[a.length - 1] };
}
export function perfStats() {
  const o = {};
  for (const k in ring) o[k] = stats(k);
  const f = o.frame;
  if (f) o.fps = 1000 / f.avg;
  o.slow = ring.frame ? Array.from(ring.frame.a.slice(0, ring.frame.n)).filter((v) => v > 20).length / ring.frame.n : 0;
  return o;
}
if (PERF) (window as any).__perf = perfStats;
/** small readout in the display canvas's top-left corner */
export function drawPerf(D, k) {
  if (!PERF) return;
  const s = perfStats(), f = (x) => (x ? x.avg.toFixed(1) + '/' + x.p95.toFixed(1) : '-');
  const lines = [`FPS ${s.fps ? s.fps.toFixed(0) : '-'}  slow ${(100 * s.slow).toFixed(0)}%`,
    `step ${f(s.step)}  world ${f(s.world)}`, `fx ${f(s.fx)}  hud ${f(s.hud)}`, `present ${f(s.present)}  ms avg/p95`];
  D.save();
  D.setTransform(1, 0, 0, 1, 0, 0);
  D.font = `${6 * k}px monospace`;
  D.fillStyle = 'rgba(0,0,0,.65)';
  D.fillRect(0, 0, 150 * k, 30 * k);
  D.fillStyle = '#7dff7d';
  lines.forEach((l, i) => D.fillText(l, 3 * k, (7 + i * 7) * k));
  D.restore();
}
