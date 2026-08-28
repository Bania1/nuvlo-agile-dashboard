export function daysBetween(start, end) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round((diff / 86400000) * 10) / 10;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 10) / 10;
}

export function summarizeTemporalMetric(values, percentileMarks = [50, 85]) {
  const clean = values.filter((value) => typeof value === 'number' && value >= 0);
  if (!clean.length) return null;
  const average = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const percentiles = Object.fromEntries(
    percentileMarks.map((mark) => [`p${mark}`, percentile(clean, Number(mark) / 100)]),
  );
  return {
    count: clean.length,
    average: Math.round(average * 10) / 10,
    percentiles,
    p50: percentiles.p50 ?? percentile(clean, 0.5),
    p85: percentiles.p85 ?? percentile(clean, 0.85),
  };
}

// Calcula metricas de flujo desde transiciones normalizadas, no desde agregados de Jira.
export function calculateFlowMetrics({ issues, config }) {
  const startStatuses = new Set(config.startStatuses);
  const doneStatuses = new Set(config.doneStatuses);
  const percentileMarks = config.percentileMarks?.length ? config.percentileMarks : [50, 85];
  const leadTimes = [];
  const cycleTimes = [];
  const incomplete = [];

  for (const issue of issues) {
    const doneTransition = issue.transitions?.find((transition) => doneStatuses.has(transition.toStatus));
    if (doneTransition) {
      const lead = daysBetween(issue.createdAt, doneTransition.at);
      if (lead !== null) leadTimes.push(lead);
    }

    const startTransition = issue.transitions?.find((transition) => startStatuses.has(transition.toStatus));
    if (startTransition && doneTransition) {
      const cycle = daysBetween(startTransition.at, doneTransition.at);
      if (cycle !== null) cycleTimes.push(cycle);
    }

    if (!issue.transitions?.length) {
      incomplete.push({ issueKey: issue.key, reason: 'MISSING_TRANSITIONS' });
    }
  }

  const wip = issues.filter((issue) => startStatuses.has(issue.status) && !doneStatuses.has(issue.status)).length;
  const velocity = issues
    .filter((issue) => doneStatuses.has(issue.status))
    .reduce((sum, issue) => sum + (Number(issue.storyPoints) || 0), 0);

  return {
    leadTime: summarizeTemporalMetric(leadTimes, percentileMarks),
    cycleTime: summarizeTemporalMetric(cycleTimes, percentileMarks),
    wip,
    velocity,
    incomplete,
  };
}
