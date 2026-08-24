import { prisma } from '../db/prisma.js';

function cleanMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata || null;
  const redacted = { ...metadata };
  for (const key of Object.keys(redacted)) {
    if (/token|secret|password/i.test(key)) redacted[key] = '[redacted]';
  }
  return redacted;
}

export async function getActivityLogs({ userId, limit = 30 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const logs = await prisma.activityLog.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  });

  return logs.map((log) => ({
    id: log.id,
    type: log.eventType,
    message: log.message,
    metadata: cleanMetadata(log.metadata),
    createdAt: log.createdAt.toISOString(),
  }));
}
