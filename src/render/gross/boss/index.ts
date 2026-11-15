// The render side of the stage-boss registry (D55): every registered boss's art, from its file in this folder (the
// default export, named by the kind), as render/gross/mid/index.ts does for the midbosses. `_name.ts` is a helper.
import type { MidArt } from '../mid';

const files = import.meta.glob<{ default: MidArt }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true });
/** kind -> its art (draw, under) */
export const BOSS_ART: Record<string, MidArt> = Object.create(null);
for (const [f, m] of Object.entries(files)) BOSS_ART[f.slice(2, -3)] = m.default;
/** kind -> draw, for render/enemies.ts DRAW */
export const BOSS_DRAW = Object.fromEntries(Object.entries(BOSS_ART).map(([k, a]) => [k, a.draw]));
