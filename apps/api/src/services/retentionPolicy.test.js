import { describe, expect, it, vi } from 'vitest';
import { buildRetentionPolicy, cleanupDatabaseRetention, cutoffDate, describeRetentionPolicy } from './retentionPolicy.js';

describe('database retention policy', () => {
  it('builds the policy from environment values', () => {
    const policy = buildRetentionPolicy({
      RETENTION_ACTIVITY_LOG_DAYS: 30,
      RETENTION_SYNC_RUN_DAYS: 60,
      RETENTION_ALERT_EVENT_DAYS: 90,
      RETENTION_METRIC_DAYS: 120,
    });

    expect(policy).toEqual({
      activityLogDays: 30,
      syncRunDays: 60,
      alertEventDays: 90,
      metricDays: 120,
    });
    expect(describeRetentionPolicy(policy)).toContain('ActivityLog: 30 dias');
  });

  it('calculates stable cutoff dates', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    expect(cutoffDate({ now, days: 10 }).toISOString()).toBe('2026-08-14T12:00:00.000Z');
  });

  it('uses count in dry-run mode and preserves active alert events', async () => {
    const count = vi.fn().mockResolvedValue(2);
    const deleteMany = vi.fn();
    const create = vi.fn();
    const client = {
      activityLog: { count, deleteMany, create },
      syncRun: { count, deleteMany },
      alertEvent: { count, deleteMany },
      metric: { count, deleteMany },
    };

    const result = await cleanupDatabaseRetention({
      client,
      dryRun: true,
      now: new Date('2026-08-24T00:00:00.000Z'),
      policy: {
        activityLogDays: 90,
        syncRunDays: 180,
        alertEventDays: 180,
        metricDays: 365,
      },
    });

    expect(result.dryRun).toBe(true);
    expect(result.deleted.activityLogs).toBe(2);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(client.alertEvent.count).toHaveBeenCalledWith({
      where: {
        status: 'RESOLVED',
        triggeredAt: { lt: new Date('2026-02-25T00:00:00.000Z') },
      },
    });
  });
});
