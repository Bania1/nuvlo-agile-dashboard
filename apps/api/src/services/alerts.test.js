import { describe, expect, it } from 'vitest';
import { evaluateAlertRule, normalizeMetricType } from './alerts.js';

describe('alert rules', () => {
  it('activates threshold alerts', () => {
    const result = evaluateAlertRule({ metricType: 'wip', operator: 'GT', threshold: 4 }, { WIP: 6 });
    expect(result.active).toBe(true);
  });

  it('normalizes metric aliases used by the UI and persisted rules', () => {
    expect(normalizeMetricType('wip')).toBe('WIP');
    expect(normalizeMetricType('leadTime')).toBe('LEAD_TIME');
    expect(normalizeMetricType('CYCLE_TIME')).toBe('CYCLE_TIME');
  });

  it('returns inactive when metric is unavailable', () => {
    const result = evaluateAlertRule({ metricType: 'LEAD_TIME', operator: 'GT', threshold: 10 }, {});
    expect(result.active).toBe(false);
    expect(result.reason).toBe('METRIC_UNAVAILABLE');
  });
});
