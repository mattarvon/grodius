// The sim side of the midboss registry: loads every kind's file, so each one calls defineMid (./roster.ts). A new kind
// is picked up from its file name; there is no list here to keep (Vite expands this glob into static imports).
import { ROSTER, MID_SIM } from './roster';

import.meta.glob(['./*.ts', '!./index.ts', '!./roster.ts'], { eager: true });

/** the kinds in the roster with no sim file behind them; main.ts refuses to boot on any (see render/gross/mid/index.ts) */
export const midsUndefined = () => ROSTER.filter((r) => !MID_SIM[r.k]).map((r) => r.k);
