// DIFFICULTY-SPEC §5.6: the W0 hooks in enemies/spawn.ts land inert. W1 has deleted the aimLead and recoveryWave stub cases (bullets.test.ts covers both)
// when it fills them (the rev, stepRecovery and one-eshots.push cases stay). eshoot tags every shot rev 0 (the D3 probe
// signal), aimLead is exact aim until W1, recoveryWave spawns nothing until W1. Mocks as d58-form.test.ts
import { describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const enemies: any[] = [], eshots: any[] = [];
vi.mock('../../src/core', () => ({ PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)) }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots, floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const S = await import('../../src/enemies/spawn');
const SRC = (await import('node:fs')).readFileSync;

describe('W0 spawn.ts hooks', () => {
  it('tags every enemy shot rev 0 (a revenge shot will carry 1; pod-probe reads it for gate D3)', () => {
    $.G = { loop: 0, pow: 0 };
    eshots.length = 0;
    S.eshoot(100, 100, 0, 1.5);
    S.fan(100, 100, 0, 3, .2, 1.5, 'orb');
    S.ring(100, 100, 6, 0, 1.2, 'glob');
    expect(eshots.length).toBe(10);
    expect(eshots.every((q) => q.rev === 0)).toBe(true);
  });
  it('counts queued recovery waves down once a step and launches each at 0, oldest first, the rest kept in order', () => {
    const q: any[] = [{ t: 2, pods: [{ ty: 0 }], id: 'a' }, { t: 1, pods: [{ ty: 5 }], id: 'b' }, { t: 0, pods: [{ ty: 6 }], id: 'c' }, { t: 5, pods: [], id: 'd' }];
    $.G = { recovery: q };
    S.stepRecovery();
    expect(q.map((w) => [w.id, w.t])).toEqual([['a', 1], ['d', 4]]); // b (t 1) and c (queued at 0) launched this step
    S.stepRecovery();
    expect(q.map((w) => w.id)).toEqual(['d']);
    $.G = {};
    expect(() => S.stepRecovery()).not.toThrow(); // no queue
  });
  it('keeps every enemy shot going through eshoot, so each carries rev (one eshots.push in src/)', () => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const root = new URL('../../src/', import.meta.url);
    const walk = (d: URL): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(e.name + '/', d)) : e.name.endsWith('.ts') ? [new URL(e.name, d).pathname] : []));
    const hits = walk(root).filter((f) => /eshots\.push\(/.test(String(SRC(decodeURIComponent(f.replace(/^\/([A-Za-z]:)/, '$1')), 'utf8'))));
    expect(hits.map((f) => f.replace(/.*\/src\//, ''))).toEqual(['enemies/spawn.ts']);
  });
});
