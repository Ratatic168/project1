/**
 * CLI-утилита для управления демо-данными:
 *   node server/cli.ts --seed   — сбросить и пересоздать демо-склад
 *   node server/cli.ts --stats  — показать сводку по БД
 */
import { db, initSchema } from './db.ts';
import { generateWarehouse, isSeeded, resetWarehouse } from './seed.ts';
import * as svc from './service.ts';

const flag = process.argv[2];

initSchema();

if (flag === '--seed') {
  if (isSeeded()) resetWarehouse();
  else generateWarehouse();
  console.log('Демо-склад пересоздан.');
} else if (flag === '--stats') {
  const d = svc.getDashboard();
  console.log(JSON.stringify(d, null, 2));
} else {
  console.log('Использование: node server/cli.ts [--seed | --stats]');
}

db.close();
