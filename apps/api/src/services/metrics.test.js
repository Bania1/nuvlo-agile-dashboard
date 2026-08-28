import { describe, expect, it } from 'vitest';
import { calculateFlowMetrics, percentile } from './metrics.js';

describe('metric calculations', () => {
  it('calculates percentiles deterministically', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.85)).toBe(3.6);
  });

  it('supports configurable percentile marks', () => {
    const result = calculateFlowMetrics({
      config: { startStatuses: ['Doing'], doneStatuses: ['Done'], percentileMarks: [50, 90] },
      issues: [
        {
          key: 'TFG-1',
          status: 'Done',
          storyPoints: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          transitions: [{ toStatus: 'Doing', at: '2026-01-02T00:00:00.000Z' }, { toStatus: 'Done', at: '2026-01-04T00:00:00.000Z' }],
        },
        {
          key: 'TFG-2',
          status: 'Done',
          storyPoints: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          transitions: [{ toStatus: 'Doing', at: '2026-01-03T00:00:00.000Z' }, { toStatus: 'Done', at: '2026-01-08T00:00:00.000Z' }],
        },
      ],
    });

    expect(result.leadTime.percentiles).toHaveProperty('p90');
    expect(result.cycleTime.percentiles).toHaveProperty('p90');
  });
  it('calculates flow metrics from issue transitions', () => {
    const result = calculateFlowMetrics({
      config: { startStatuses: ['In Progress'], doneStatuses: ['Done'] },
      issues: [{
        key: 'TFG-1',
        status: 'Done',
        storyPoints: 8,
        createdAt: '2026-01-01T00:00:00.000Z',
        transitions: [
          { toStatus: 'In Progress', at: '2026-01-02T00:00:00.000Z' },
          { toStatus: 'Done', at: '2026-01-05T00:00:00.000Z' },
        ],
      }],
    });
    expect(result.leadTime.average).toBe(4);
    expect(result.cycleTime.average).toBe(3);
    expect(result.velocity).toBe(8);
  });
});

