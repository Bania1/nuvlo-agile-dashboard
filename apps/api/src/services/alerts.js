const metricAliases = {
  velocity: 'VELOCITY',
  wip: 'WIP',
  lead_time: 'LEAD_TIME',
  leadTime: 'LEAD_TIME',
  cycle_time: 'CYCLE_TIME',
  cycleTime: 'CYCLE_TIME',
  throughput: 'THROUGHPUT',
};

export const supportedMetricTypes = ['VELOCITY', 'WIP', 'LEAD_TIME', 'CYCLE_TIME', 'THROUGHPUT'];
export const supportedAlertOperators = ['GT', 'GTE', 'LT', 'LTE'];

export function normalizeMetricType(metricType) {
  const raw = String(metricType || '');
  const normalized = metricAliases[raw] || metricAliases[raw.toLowerCase()] || raw.toUpperCase();
  return supportedMetricTypes.includes(normalized) ? normalized : null;
}

export function metricLabel(metricType) {
  return {
    VELOCITY: 'Velocity',
    WIP: 'WIP',
    LEAD_TIME: 'Lead Time',
    CYCLE_TIME: 'Cycle Time',
    THROUGHPUT: 'Throughput',
  }[metricType] || metricType;
}

export function operatorLabel(operator) {
  return {
    GT: 'mayor que',
    GTE: 'mayor o igual que',
    LT: 'menor que',
    LTE: 'menor o igual que',
  }[operator] || operator;
}

export function evaluateAlertRule(rule, metrics) {
  const metricType = normalizeMetricType(rule.metricType);
  const value = metrics[metricType] ?? metrics[String(rule.metricType || '').toLowerCase()];
  if (typeof value !== 'number' || Number.isNaN(value)) return { active: false, reason: 'METRIC_UNAVAILABLE' };
  const threshold = Number(rule.threshold);
  const active = rule.operator === 'GT' ? value > threshold
    : rule.operator === 'GTE' ? value >= threshold
    : rule.operator === 'LT' ? value < threshold
    : rule.operator === 'LTE' ? value <= threshold
    : false;
  return { active, value, threshold };
}
