// Loads every stage-boss kind file in this folder (D55): each one calls defineBoss at load. `_name.ts` is a helper.
// enemies/update.ts imports this, the way it imports ../mid.
import.meta.glob(['./*.ts', '!./index.ts', '!./registry.ts', '!./_*.ts'], { eager: true });
