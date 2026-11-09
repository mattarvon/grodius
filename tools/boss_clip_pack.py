#!/usr/bin/env python3
"""Packs tools/boss-clip.mjs frames into a looping animated WebP at x1.5, plus a contact sheet of every 40th frame.
Usage: python3 -I tools/boss_clip_pack.py <outDir> <subject> [...]   Writes <outDir>/<subject>.webp and <outDir>/<subject>_sheet.jpg"""
import glob, sys
from PIL import Image
NEAR = Image.Resampling.NEAREST
out = sys.argv[1]
for k in sys.argv[2:]:
    fs = sorted(glob.glob(f'{out}/{k}/f*.png'))
    ims = [Image.open(f).convert('RGB').resize((720, 405), Image.Resampling.BOX) for f in fs]
    ims[0].save(f'{out}/{k}.webp', save_all=True, append_images=ims[1:], duration=33, loop=0, quality=60, method=4)
    pick = fs[::40]; cols = 5; rows = (len(pick) + cols - 1) // cols
    sh = Image.new('RGB', (cols * 480, rows * 270))
    for i, f in enumerate(pick): sh.paste(Image.open(f).convert('RGB'), ((i % cols) * 480, (i // cols) * 270))
    sh.save(f'{out}/{k}_sheet.jpg', quality=88); print(k, len(fs), 'frames')
