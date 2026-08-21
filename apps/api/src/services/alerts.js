export function evaluateAlertRule(rule, metrics) {
  const value = metrics[rule.metricType];
  if (typeof value !== 'number') return { active: false, reason: 'METRIC_UNAVAILABLE' };
  const threshold = Number(rule.threshold);
  const active = rule.operator === 'GT' ? value > threshold
    : rule.operator === 'GTE' ? value >= threshold
    : rule.operator === 'LT' ? value < threshold
    : rule.operator === 'LTE' ? value <= threshold
    : false;
  return { active, value, threshold };
}
