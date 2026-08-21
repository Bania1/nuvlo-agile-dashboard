import { describe, expect, it } from 'vitest';
import { calculateFlowMetrics, percentile } from './metrics.js';

describe('metric calculations', () => {
  it('calculates percentiles deterministically', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.85)).toBe(3.6);
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
