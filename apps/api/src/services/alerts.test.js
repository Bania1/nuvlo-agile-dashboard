import { describe, expect, it } from 'vitest';
import { evaluateAlertRule } from './alerts.js';

describe('alert rules', () => {
  it('activates threshold alerts', () => {
    const result = evaluateAlertRule({ metricType: 'wip', operator: 'GT', threshold: 4 }, { wip: 6 });
    expect(result.active).toBe(true);
  });
});
