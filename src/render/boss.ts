// @ts-nocheck
import { $ } from '../state';
import { C, W, ctx } from '../core';
import { light } from '../render/util';
import { drawDrive } from './gross/drive';

// --- boss ---
export function drawBoss(b) {
  // body, eye, guts, gauges and all the leaking: render/gross/drive.ts. null b = the aftermath of its rupture
  drawDrive(b);
  if (!b) return;
  light(b.x, b.y, 120, .8);
  if (b.laser) {
    const L = b.laser,
      ca = Math.cos(L.ang),
      sa = Math.sin(L.ang),
      ex = b.x + ca * 600,
      ey = b.y + sa * 600;
    if (L.tel > 0) {
      // charge: a widening red band (the beam's real width at the end), white and blinking once the aim locks
      const k = 1 - L.tel / (L.ml || 60), locked = L.tel <= 20;
      ctx.strokeStyle = locked ? `rgba(255,235,225,${.35 + .45 * (($.T >> 1) % 2)})` : `rgba(255,40,40,${.12 + .2 * k})`;
      ctx.lineWidth = 1 + 11 * k;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,40,40,${.5 + .4 * (($.T >> 1) % 2)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,30,30,.45)';
      ctx.lineWidth = 14 + 2 * Math.sin($.T * 1.9); // render-side jitter (no gameplay RNG)
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,190,.95)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'butt';
      for (let i = 0; i < 40; i += 8) light(b.x + ca * i * 12, b.y + sa * i * 12, 40, .9);
    }
  }
  if (!b.dying) {
    const w = 180;
    ctx.fillStyle = '#1a0204';
    ctx.fillRect(W / 2 - w / 2, 16, w, 3);
    const pl = b.plates.reduce((s, p) => s + Math.max(0, p.hp), 0),
      pm = b.plates.reduce((s, p) => s + p.max, 0);
    ctx.fillStyle = C.bloodL;
    ctx.fillRect(W / 2 - w / 2, 16, w * Math.max(0, b.hp / b.max), 3);
    if (pl > 0) {
      ctx.fillStyle = '#9fb0c2';
      ctx.fillRect(W / 2 - w / 2, 20, w * pl / pm, 1);
    }
  }
}

// --- gibs & gore ---
