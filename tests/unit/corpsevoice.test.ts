import { describe, expect, it } from 'vitest';
import { CORPSE_VOICE, corpseKilled, corpseVoiceAt } from '../../src/enemies/corpsevoice';

/** kill `n` corpses in one stage's fresh stats; returns the 1-based kills that pleaded */
function pleas(stage: number, loop: number, n: number) {
  const st: { corpseN?: number; corpseVo?: boolean } = {};
  const out: number[] = [];
  for (let k = 1; k <= n; k++) if (corpseKilled(st, stage, loop)) out.push(k);
  return out;
}

describe('corpseVoiceAt', () => {
  it('always picks a kill from 1 to the span', () => {
    for (let loop = 0; loop < 4; loop++) for (let stage = 0; stage < 20; stage++) {
      const t = corpseVoiceAt(stage, loop);
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(1);
      expect(t).toBeLessThanOrEqual(CORPSE_VOICE.span);
    }
  });

  it('varies the kill across the stages of a descent and across loops', () => {
    const d1 = Array.from({ length: 8 }, (_, s) => corpseVoiceAt(s, 0));
    expect(new Set(d1).size).toBeGreaterThanOrEqual(3);
    const byLoop = Array.from({ length: 8 }, (_, s) => corpseVoiceAt(s, 1));
    expect(byLoop).not.toEqual(d1);
  });

  it('is a pure function of stage and loop', () => {
    expect(corpseVoiceAt(5, 2)).toBe(corpseVoiceAt(5, 2));
  });
});

describe('corpseKilled', () => {
  it('pleads exactly once in a stage, on the stage target kill', () => {
    for (let stage = 0; stage < 12; stage++) expect(pleas(stage, 0, 40)).toEqual([corpseVoiceAt(stage, 0)]);
  });

  it('never pleads twice in a stage even when the count is wound back', () => {
    // a resume restores G.st from an earlier checkpoint; corpseVo keeps a played plea from repeating
    const st: { corpseN?: number; corpseVo?: boolean } = {};
    const t = corpseVoiceAt(3, 0);
    for (let k = 1; k <= t; k++) corpseKilled(st, 3, 0);
    expect(st.corpseVo).toBe(true);
    st.corpseN = 0;
    let again = 0;
    for (let k = 0; k < 20; k++) if (corpseKilled(st, 3, 0)) again++;
    expect(again).toBe(0);
  });

  it('stays quiet in a stage with fewer corpse kills than its target', () => {
    const stage = Array.from({ length: 20 }, (_, s) => s).find((s) => corpseVoiceAt(s, 0) > 1)!;
    expect(pleas(stage, 0, corpseVoiceAt(stage, 0) - 1)).toEqual([]);
  });

  it('pleads again in the next stage once its stats are fresh', () => {
    expect(pleas(0, 0, 10)).toHaveLength(1);
    expect(pleas(1, 0, 10)).toHaveLength(1);
  });
});
