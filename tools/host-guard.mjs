// W6 round 3 (measure-only, no sim write, no R()): keep the HOST's input out of a headless probe page. Pass to
// page.addInitScript before the game boots: `await p.addInitScript(hostGuard)`.
// - Focus and display: a screen lock or a window switch blurs and hides every headless page at once, and input.ts then
//   drops the held fire key and opens the pause menu, which ends or silently changes a run (2026-11-23 20:33: four
//   pod-probe runs paused at the same second, one fired less from 8 s on). The guard swallows blur and
//   visibilitychange before the game's own listeners (registered later) and reports the page as always visible.
// - The host's gamepad: headless Chromium reads the real pads plugged into the machine (input.ts pollInput), so Matt
//   playing on his controller steered, fired and paused (Start) every probe page. A probe flies with no pad.
// Headless pages are already visible and padless when nothing happens on the host, so a guarded run reads the same as
// an unguarded one that wasn't disturbed (T1: harness short and layout-parity stay byte-identical).
export const hostGuard = () => {
  const stop = (e) => e.stopImmediatePropagation();
  addEventListener('blur', stop, true);
  document.addEventListener('visibilitychange', stop, true);
  try { Object.defineProperty(document, 'hidden', { get: () => false }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); } catch (e) {}
  try { Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true }); } catch (e) {}
};
