// The back tree (LS1 audit S2 #1, #2; Matt's armory bug): Android back, Esc, Backspace, X in menus and pad B all ask
// backStep() what one press means, so the phone and the desktop agree. A leaf: no imports, so tests drive it directly.
// menus.ts doBack() applies the answer through the existing actions; main.ts calls App.exitApp() for 'exit'.

/** what the back press sees. sub: the title sub-menu open (OPTIONS 'opt', LAB 'lab'); gate: the title's press-any-key
 *  gate; asked: the flashing-images question has been answered (SET.asked); onExitRow: the Infirmary's last row
 *  (RETURN / DESCEND) is selected; native: the Capacitor app (only there can the game exit); exitArmed: a first
 *  Android back at the title root armed the exit less than EXIT_ARM_T frames ago (exitLive) */
export interface BackView {
  state: 'title' | 'shop' | 'pause' | 'over' | 'play';
  sub: null | 'opt' | 'lab';
  gate: boolean;
  asked: boolean;
  shopNext: 'title' | 'loop';
  onExitRow: boolean;
  overT: number;
  native: boolean;
  exitArmed: boolean;
}
export type BackAct = 'exit' | 'armExit' | 'closeSub' | 'leaveShop' | 'selectExit' | 'unpause' | 'pause' | 'surface' | 'none';

/** the over screen's menu opens after this many frames (step.ts); a back press before it is ignored, like a tap */
export const OVER_MENU_T = 70;

/** the title root's leave window (Matt's bug: one Android back threw him out of the game): a first press arms, a
 *  second inside this many frames ($.T, 2 s at 60 Hz) exits */
export const EXIT_ARM_T = 120;
/** is an exit armed at frame armT still live at frame T? (null: not armed) */
export const exitLive = (armT: number | null, T: number) => armT !== null && T - armT <= EXIT_ARM_T;

/** one back press, one level up. Never 'exit' from a sub-menu, never off the native app, and never on a first press */
export function backStep(v: BackView): BackAct {
  switch (v.state) {
    case 'title':
      // the gate and the flashing-images question are the title root too: the question replaces any sub-menu
      if (v.sub && !v.gate && v.asked) return 'closeSub';
      if (!v.native) return 'none';
      return v.exitArmed ? 'exit' : 'armExit';
    case 'shop':
      // between descents the exit row is DESCEND: the first press only selects it, so a stray back can't start a stage
      return v.shopNext === 'loop' && !v.onExitRow ? 'selectExit' : 'leaveShop';
    case 'pause':
      return 'unpause';
    case 'play':
      return 'pause';
    case 'over':
      return v.overT > OVER_MENU_T ? 'surface' : 'none';
  }
  return 'none';
}

/** did this step's input press back here? On the over screen only Esc and Backspace count (hardBack): X and pad B
 *  are POWER too, and mashing power through a death must not SURFACE (Android back reaches doBack directly) */
export function backPressed(state: BackView['state'], i: { back: boolean; hardBack: boolean }): boolean {
  return state === 'over' ? i.hardBack : i.back;
}

/** the DESCEND confirm while a run save exists (S2 #1): a pointer tap on a `confirm` row arms it, a second tap on the
 *  same armed row acts. A row without confirm acts at once and disarms. Keys and pad never come through here */
export function descendTap(armed: number | null, row: number, confirm: boolean): { act: boolean; armed: number | null } {
  if (!confirm || armed === row) return { act: true, armed: null };
  return { act: false, armed: row };
}
/** an armed DESCEND row disarms after this many frames ($.T, never wall-clock) */
export const ARM_T = 180;

/** the Infirmary's exit button, anchored to the bottom-left (H - 38), outside the list's flow (game px) */
export const SHOP_EXIT = { x: 12, y: 232, w: 96, wLoop: 120, h: 32 };
/** the title sub-menus' BACK button (game px) */
export const SUB_BACK = { x: 28, y: 206, w: 96, h: 32 };
/** the title menu (render/screens.ts drawMenu): first row y and row pitch; a row's box is 13 tall from y - 3 */
export const TITLE_MENU = { y: 110, pitch: 14 };
/** the bottom of an n-row title menu's last box; a sub-menu's must stay <= SUB_BACK.y */
export const titleMenuBottom = (n: number) => TITLE_MENU.y + (n - 1) * TITLE_MENU.pitch + 10;
/** the Infirmary list's flow (render/screens.ts drawShop): first row y, a section head's height, the gap before every
 *  head but the first, a row's pitch and its box height */
export const SHOP_LIST = { top: 45, head: 10, gap: 2, pitch: 11, rh: 10 };
/** the bottom of the last row's box for sections of these sizes, indexed by section (menus.ts shopSec; the exit row
 *  excluded); must stay <= SHOP_EXIT.y - 2. drawShop's rule: an empty section draws no head, and the gap goes before
 *  every head whose section index is not 0, whatever came before it */
export function shopListBottom(secs: number[]): number {
  let y = SHOP_LIST.top;
  secs.forEach((n, sc) => {
    if (n > 0) y += (sc ? SHOP_LIST.gap : 0) + SHOP_LIST.head + n * SHOP_LIST.pitch;
  });
  return y - SHOP_LIST.pitch - 2 + SHOP_LIST.rh;
}
