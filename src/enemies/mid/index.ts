// The sim side of the midboss registry: loads every kind's file, so each one calls defineMid (./roster.ts). A new kind
// is picked up from its file name; there is no list here to keep (Vite expands this glob into static imports).
// main.ts refuses to boot if a roster row has no file here (render/gross/mid/index.ts checkMids, roster.ts midProblems).

import.meta.glob(['./*.ts', '!./index.ts', '!./roster.ts', '!./_*.ts'], { eager: true }); // _name.ts: a shared helper, not a kind
