import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';

const dayMs = 24 * 60 * 60 * 1000;

export function cutoffDate({ now = new Date(), days }) {
  return new Date(now.getTime() - Number(days) * dayMs);
}

export function buildRetentionPolicy(environment = env) {
  return {
    activityLogDays: environment.RETENTION_ACTIVITY_LOG_DAYS,
    syncRunDays: environment.RETENTION_SYNC_RUN_DAYS,
    alertEventDays: environment.RETENTION_ALERT_EVENT_DAYS,
    metricDays: environment.RETENTION_METRIC_DAYS,
  };
}

export function describeRetentionPolicy(policy = buildRetentionPolicy()) {
  return [
    `ActivityLog: ${policy.activityLogDays} dias`,
    `SyncRun: ${policy.syncRunDays} dias`,
    `AlertEvent resueltos: ${policy.alertEventDays} dias`,
    `Metric: ${policy.metricDays} dias`,
  ].join('; ');
}

function resultCount(value) {
  return typeof value === 'number' ? value : value?.count || 0;
}

function cleanupPlan({ policy, now }) {
  return {
    activityLog: {
      where: { createdAt: { lt: cutoffDate({ now, days: policy.activityLogDays }) } },
    },
    syncRun: {
      where: { startedAt: { lt: cutoffDate({ now, days: policy.syncRunDays }) } },
    },
    alertEvent: {
      where: {
        status: 'RESOLVED',
        triggeredAt: { lt: cutoffDate({ now, days: policy.alertEventDays }) },
      },
    },
    metric: {
      where: { createdAt: { lt: cutoffDate({ now, days: policy.metricDays }) } },
    },
  };
}

export async function cleanupDatabaseRetention({
  client = prisma,
  policy = buildRetentionPolicy(),
  dryRun = false,
  now = new Date(),
} = {}) {
  const plan = cleanupPlan({ policy, now });
  const action = dryRun ? 'count' : 'deleteMany';

  const [activityLogs, syncRuns, alertEvents, metrics] = await Promise.all([
    client.activityLog[action](plan.activityLog),
    client.syncRun[action](plan.syncRun),
    client.alertEvent[action](plan.alertEvent),
    client.metric[action](plan.metric),
  ]);

  const result = {
    dryRun,
    policy,
    deleted: {
      activityLogs: resultCount(activityLogs),
      syncRuns: resultCount(syncRuns),
      alertEvents: resultCount(alertEvents),
      metrics: resultCount(metrics),
    },
    cutoffs: {
      activityLogs: plan.activityLog.where.createdAt.lt.toISOString(),
      syncRuns: plan.syncRun.where.startedAt.lt.toISOString(),
      alertEvents: plan.alertEvent.where.triggeredAt.lt.toISOString(),
      metrics: plan.metric.where.createdAt.lt.toISOString(),
    },
  };

  if (!dryRun) {
    await client.activityLog.create({
      data: {
        eventType: 'USER_ACTION',
        message: 'Limpieza de retencion de base de datos ejecutada.',
        metadata: {
          retention: result.policy,
          deleted: result.deleted,
          cutoffs: result.cutoffs,
        },
      },
    });
  }

  return result;
}
