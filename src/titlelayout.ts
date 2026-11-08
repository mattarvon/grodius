// Where the title screen puts things, and the rects the title's easter egg must keep out of. drawTitle and drawTitleEye
// read these positions, and the egg's rails and tests/unit/titleblood.test.ts read the rects, so moving a title element
// here moves its no-go rect and a rail that no longer clears it fails the test. A leaf: no DOM, so tests import it.
import { SUB_BACK, TITLE_MENU, titleMenuBottom } from './backstep';

export const TITLE = {
  logo: { x: 26, y: 30, size: 64 },
  sub: { x: 28, y: 96 },
  help: { x: 28, y: 208, pitch: 9 },
  hi: { x: 28, y: 240 },
  right: 472,                        // right edge of the credits and the age line
  credits: { y: 231, pitch: 9 },
  age: { y: 258 },
  eye: { x: 396, y: 116.84, r: 88 }, // the ROT ball; y is .46 of the 254 px playfield
};

/** Text widths in px, measured in the real fonts (Grenze Gotisch at 64 px, Silkscreen at 8 and 7 px; browser measureText).
 *  Widest variant of each line: help's second row is 295 with the meter on. Re-measure if a string changes */
const TEXT_W = { logo: 243, sub: 177, help: 295, hi: 61, credits: 322, age: 158 };
const LINE = 8; // a Silkscreen row's height

const rect = (n: string, x0: number, y0: number, x1: number, y1: number) => ({ n, x0, y0, x1, y1 });
const T = TITLE;
const ROPE_X = T.eye.x + T.eye.r * .4; // drawTitleEye's rope: its root, leaning 10 px, swaying 3 px, 22 px wide at most

/** Everything the egg stays off, on the 480x270 canvas; x1 and y1 exclusive. The logo glitches 4 px sideways */
export const TITLE_NOGO = [
  rect('logo', T.logo.x - 4, T.logo.y, T.logo.x + TEXT_W.logo + 4, T.sub.y - 4),
  rect('subtitle', T.sub.x, T.sub.y, T.sub.x + TEXT_W.sub, T.sub.y + LINE),
  rect('menu', T.sub.x, TITLE_MENU.y - 3, 202, titleMenuBottom(7) + 2), // the cursor to the rows' touch boxes (drawMenu)
  rect('help', T.help.x, T.help.y, T.help.x + TEXT_W.help, T.help.y + T.help.pitch * 2 + LINE),
  rect('hi', T.hi.x, T.hi.y, T.hi.x + TEXT_W.hi, T.hi.y + LINE),
  rect('credits', T.right - TEXT_W.credits, T.credits.y, T.right, T.credits.y + T.credits.pitch * 2 + LINE),
  rect('age', T.right - TEXT_W.age, T.age.y, T.right, T.age.y + LINE),
  rect('subBack', SUB_BACK.x, SUB_BACK.y, SUB_BACK.x + SUB_BACK.w, SUB_BACK.y + SUB_BACK.h),
  rect('rope', ROPE_X - 14, 0, ROPE_X + 24, T.eye.y),
];
/** how near the ball's centre the egg may come: the lumpy outline reaches 1.05r, plus the wobble and some air */
export const TITLE_EYE_CLEAR = T.eye.r * 1.05 + 8;
