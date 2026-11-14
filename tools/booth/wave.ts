// The booth's waveform and spectrogram displays: wavesurfer.js 8 (BSD-3-Clause, https://wavesurfer.xyz) with its
// Spectrogram, Timeline, Hover and Regions plugins. Loaded at runtime by URL from node_modules, never imported
// statically: a bare import would go through Vite's dep optimizer (a re-optimize mid-session answers an open page with
// 504s, and the optimizer cache is shared with every checkout on this node_modules), and the page's static graph stays
// leaf-only (tests/unit/booth.test.ts). If the library can't load, every display keeps its plain <audio controls>.
// No imports: the types come in through type-level import() only.

type WaveSurfer = import('wavesurfer.js').default;
type Lib = {
  WaveSurfer: typeof import('wavesurfer.js').default;
  Spectrogram: { create(o?: object): any };
  Timeline: { create(o?: object): any };
  Hover: { create(o?: object): any };
  Regions: { create(o?: object): any };
};
const DIST = '/node_modules/wavesurfer.js/dist/';
let lib: Promise<Lib | null> | null = null;
/** the library and its plugins, loaded once (each plugin bundle is self-contained). null when it can't load */
export const loadWave = () => (lib ||= Promise.all(['wavesurfer.esm.js', 'plugins/spectrogram.esm.js', 'plugins/timeline.esm.js', 'plugins/hover.esm.js', 'plugins/regions.esm.js']
  .map((f) => import(/* @vite-ignore */ DIST + f)))
  .then(([w, s, t, h, r]) => ({ WaveSurfer: w.default, Spectrogram: s.default, Timeline: t.default, Hover: h.default, Regions: r.default }))
  .catch((e) => { console.warn('booth: wavesurfer.js did not load; plain players instead.', e); return null; }));

/** the spectrogram's colours, 256 RGBA stops (0..1): black, dried blood, arterial red, flame, bone */
const GORE: number[][] = (() => {
  const st = [[0, 0, 0, 0, 1], [0.22, 0.16, 0.01, 0.03, 1], [0.48, 0.55, 0.03, 0.07, 1], [0.72, 0.95, 0.3, 0.1, 1], [0.88, 1, 0.7, 0.35, 1], [1, 1, 0.97, 0.9, 1]];
  return Array.from({ length: 256 }, (_, i) => {
    const x = i / 255, j = Math.max(1, st.findIndex((s) => s[0] >= x)), a = st[j - 1], b = st[j], f = (x - a[0]) / (b[0] - a[0] || 1);
    return [1, 2, 3, 4].map((c) => a[c] + (b[c] - a[c]) * f);
  });
})();
const secs = (s: number) => (s < 10 ? s.toFixed(s % 1 ? 1 : 0) : s.toFixed(0)) + 's';

export type Disp = { ws: WaveSurfer; regions: any | null; destroy(): void };
/** a waveform (and a spectrogram under it, with spectro) in `box`, playing through `media`, the page's own <audio>:
 *  the element stays the player (and the tests' handle), wavesurfer only draws it and seeks it. null when the library
 *  is missing or the box went away while it loaded */
export async function attach(box: HTMLElement, media: HTMLAudioElement, url: string,
  o: { spectro?: boolean; height?: number; color?: string; progress?: string; regions?: boolean } = {}): Promise<Disp | null> {
  const L = await loadWave();
  if (!L || !box.isConnected || !media.isConnected) return null;
  const regions = o.regions ? L.Regions.create() : null;
  const plugins = [
    L.Timeline.create({ height: 13, formatTimeCallback: secs, style: { color: '#8a7a7e', fontSize: '10px', fontFamily: 'Silkscreen, ui-monospace, monospace' } }),
    L.Hover.create({ lineColor: '#ff4a5a', lineWidth: 1, labelBackground: '#1a0b0e', labelColor: '#ffd9dc', labelSize: '10px', formatTimeCallback: (s: number) => s.toFixed(2) + ' s' }),
    ...(o.spectro ? [L.Spectrogram.create({ height: 84, labels: true, labelsBackground: '#0b0607cc', labelsColor: '#b89a9e', labelsHzColor: '#6e5a5e', scale: 'mel', frequencyMin: 40, frequencyMax: 16000, fftSamples: 512, colorMap: GORE, useWebWorker: false })] : []),
    ...(regions ? [regions] : []),
  ];
  let ws: WaveSurfer;
  try {
    ws = L.WaveSurfer.create({
      container: box, media, url, height: o.height ?? 56, waveColor: o.color ?? '#7a2a34', progressColor: o.progress ?? '#ff4a5a', cursorColor: '#ffe7ea', cursorWidth: 1,
      barWidth: 2, barGap: 1, barRadius: 1, sampleRate: 44100, normalize: false, dragToSeek: !regions, plugins,
    });
  } catch (e) { console.warn('booth: waveform failed', e); return null; }
  media.classList.add('ws-on');
  // a take the browser can't decode keeps its plain player
  ws.on('error', () => media.classList.remove('ws-on'));
  return { ws, regions, destroy() { try { ws.destroy(); } catch { /* already gone */ } media.classList.remove('ws-on'); } };
}
