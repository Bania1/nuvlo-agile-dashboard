import { prisma } from '../apps/api/src/db/prisma.js';
import { cleanupDatabaseRetention, describeRetentionPolicy } from '../apps/api/src/services/retentionPolicy.js';

const dryRun = process.argv.includes('--dry-run');

try {
  const result = await cleanupDatabaseRetention({ dryRun });
  console.log(`[nuvlo] Politica de retencion: ${describeRetentionPolicy(result.policy)}`);
  console.log(`[nuvlo] Modo: ${dryRun ? 'simulacion, no borra datos' : 'limpieza real'}`);
  console.table(result.deleted);
  console.log('[nuvlo] Fechas limite:', result.cutoffs);
} catch (error) {
  console.error('[nuvlo] Error ejecutando limpieza de retencion:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
