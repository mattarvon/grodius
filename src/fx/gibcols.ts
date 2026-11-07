// The colours gib() rolls (fx/spawn.ts), shared with the atlas that bakes them (render/gibart.ts): one list, so a new
// colour can't spawn a gib the atlas has no cell for. Chunks also roll C.blood, which is per palette (gibart bakes those)
import { C } from '../core';

/** flesh chunk colours before the palette's blood. Order is the spick() order: keep it, the render stream counts on it */
export const GIB_FLESH: readonly string[] = [C.flesh, C.fleshD, '#8e3a32', '#a3473c'];
/** metal shard colours */
export const GIB_METAL: readonly string[] = ['#3a434d', '#56616d', '#2a3038'];
