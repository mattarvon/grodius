// The render side of the stage-boss registry (D55): every registered boss's art, from its file in this folder (the
// default export, named by the kind), as render/gross/mid/index.ts does for the midbosses. `_name.ts` is a helper.
import type { MidArt } from '../mid';
import { BOSS_SIM, bossFor } from '../../../enemies/boss/registry';
import '../../../enemies/boss'; // every boss's sim side registered before checkBosses reads BOSS_SIM

const files = import.meta.glob<{ default: MidArt }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true });
/** kind -> its art (draw, under) */
export const BOSS_ART: Record<string, MidArt> = Object.create(null);
for (const [f, m] of Object.entries(files)) BOSS_ART[f.slice(2, -3)] = m.default;
/** kind -> draw, for render/enemies.ts DRAW */
export const BOSS_DRAW = Object.fromEntries(Object.entries(BOSS_ART).map(([k, a]) => [k, a.draw]));

/** fail loudly at boot (main.ts): a boss bossFor can place with no sim file (defineBoss) or no art file, or art with no
 *  sim. In a bundle a load-order slip would otherwise drop the boss silently and the biome's own would fight there */
export function checkBosses(): void {
  const want = new Set([bossFor(1, 0, true)].filter(Boolean) as string[]);
  const bad = [...want, ...Object.keys(BOSS_ART), ...Object.keys(BOSS_SIM)].filter((k, i, a) => a.indexOf(k) === i && (!BOSS_SIM[k] || !BOSS_ART[k]));
  if (bad.length) throw new Error('stage-boss registry: ' + bad.map((k) => `${k} (${BOSS_SIM[k] ? 'no render/gross/boss file' : 'no enemies/boss defineBoss'})`).join(', '));
}
