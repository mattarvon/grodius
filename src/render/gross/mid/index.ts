// The render side of the midboss registry: every kind's art, from its file in this folder. A file's default export is
// the art, its name is the kind. The render side may read the sim's roster; the sim never imports this.
import { MID_SIM, ROSTER, midProblems } from '../../../enemies/mid/roster';
import '../../../enemies/mid'; // every kind's sim side registered before checkMids reads MID_SIM

/** a kind's art. warm: build one slice, true while more slices remain; keep a slice under ~4 ms on the phone (it can
 *  land on a busy frame). built and drop: route art with a cached layer (a boot kind or a greybox has neither) */
export interface MidArt {
  draw: (c: CanvasRenderingContext2D, e: any) => void;
  /** drawEnemy, before the body: a telegraph or a chain that sits under it */
  under?: (e: any) => void;
  warm: () => boolean;
  built?: () => boolean;
  drop?: () => void;
}

const files = import.meta.glob<{ default: MidArt }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true }); // _name.ts: a helper (_greybox.ts)
/** kind -> its art, in roster order (the warm-up walks it, so a drop pass goes in a fixed order) */
export const MID_ART: Record<string, MidArt> = Object.create(null);
for (const r of ROSTER) if (files[`./${r.k}.ts`]) MID_ART[r.k] = files[`./${r.k}.ts`].default;
/** kind -> draw, for render/enemies.ts DRAW */
export const MID_DRAW = Object.fromEntries(Object.entries(MID_ART).map(([k, a]) => [k, a.draw]));

/** fail loudly at boot: a roster row missing either side would otherwise only show when the picker first draws it */
export function checkMids(): void {
  const bad = midProblems(ROSTER, MID_SIM, Object.keys(files).map((f) => f.slice(2, -3)));
  if (bad.length) throw new Error('midboss registry: ' + bad.join(', '));
}
