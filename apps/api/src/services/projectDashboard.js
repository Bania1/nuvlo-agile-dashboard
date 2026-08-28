import { prisma } from '../db/prisma.js';
import { calculateFlowMetrics, daysBetween, summarizeTemporalMetric } from './metrics.js';
import { getPersistedProjectIssues } from './jiraSync.js';
import { getProjectAndAnalysisScope, scopeConfig } from './analysisScope.js';

function normalizeMetric(metric) {
  return metric || { count: 0, average: 0, percentiles: {}, p50: 0, p85: 0 };
}

function formatSyncDate(date) {
  if (!date) return 'Sync Jira';
  return `Sync ${new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)}`;
}

function normalizedText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isDoneIssue(issue, doneStatuses = []) {
  const configured = doneStatuses.some((status) => issue.status === status);
  const category = normalizedText(issue.statusCategory);
  const status = normalizedText(issue.status);
  return configured || ['done', 'listo'].includes(category) || ['done', 'finalizada', 'finalizado'].includes(status);
}

function isInProgressIssue(issue, startStatuses = [], doneStatuses = []) {
  const configured = startStatuses.some((status) => issue.status === status) && !doneStatuses.some((status) => issue.status === status);
  const category = normalizedText(issue.statusCategory);
  const status = normalizedText(issue.status);
  return configured || ['in progress', 'en curso'].includes(category) || ['in progress', 'en curso', 'review', 'revision'].includes(status);
}

function statusBreakdown(issues) {
  const counts = new Map();
  for (const issue of issues) {
    counts.set(issue.status, (counts.get(issue.status) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

function recentIssues(issues) {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)
    .map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      type: issue.type,
      team: 'Jira',
      points: issue.storyPoints ?? 0,
      assignee: issue.assignee,
      labels: issue.labels || [],
    }));
}

function buildThroughputSeries(issues, config) {
  const hasSprintData = issues.some((issue) => issue.sprint?.name);
  const buckets = new Map();
  for (const issue of issues) {
    const updatedAt = new Date(issue.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) continue;
    const key = hasSprintData ? issue.sprint?.name || 'Sin sprint' : updatedAt.toISOString().slice(0, 10);
    const label = hasSprintData ? key : key.slice(5);
    const current = buckets.get(key) || { sprint: label, committed: 0, completed: 0, wip: 0, done: 0 };
    const effort = issue.storyPoints ?? 1;
    current.committed += effort;
    if (isDoneIssue(issue, config.doneStatuses)) {
      current.completed += effort;
      current.done += 1;
    }
    if (isInProgressIssue(issue, config.startStatuses, config.doneStatuses)) current.wip += 1;
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) => a.sprint.localeCompare(b.sprint)).slice(-8);
}

function inferDoneTransition(issue, doneStatuses = []) {
  const persistedDone = issue.transitions?.find((transition) => doneStatuses.includes(transition.toStatus));
  if (persistedDone) return persistedDone;
  if (!isDoneIssue(issue, doneStatuses)) return null;
  return { toStatus: issue.status, at: issue.updatedAt };
}

function summarizeLeadTimeFromCurrentState(issues, config) {
  const values = issues
    .map((issue) => {
      const doneTransition = inferDoneTransition(issue, config.doneStatuses);
      return doneTransition ? daysBetween(issue.createdAt, doneTransition.at) : null;
    })
    .filter((value) => value !== null);
  return summarizeTemporalMetric(values, config.percentileMarks);
}

function filterIssuesByScope(issues, config) {
  return issues.filter((issue) => {
    if (config.issueTypes.length && !config.issueTypes.includes(issue.type)) return false;
    if (config.labels.length && !config.labels.some((label) => (issue.labels || []).includes(label))) return false;

    const updatedAt = new Date(issue.updatedAt);
    if (config.dateFrom && updatedAt < config.dateFrom) return false;
    if (config.dateTo) {
      const endOfDay = new Date(config.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (updatedAt > endOfDay) return false;
    }
    return true;
  });
}

async function resolveDashboardConfig({ userId, cloudId, projectKey, issues }) {
  if (userId) {
    const { scope } = await getProjectAndAnalysisScope({ userId, cloudId, projectKey });
    return { ...scopeConfig(scope), scopeId: scope.id, scopeName: scope.name, source: 'analysis-scope' };
  }

  const statuses = [...new Set(issues.map((issue) => issue.status))];
  return {
    labels: [],
    issueTypes: [],
    dateFrom: null,
    dateTo: null,
    startStatuses: statuses.filter((status) => issues.some((issue) => issue.status === status && isInProgressIssue(issue))),
    doneStatuses: statuses.filter((status) => issues.some((issue) => issue.status === status && isDoneIssue(issue))),
    percentileMarks: [50, 85],
    scopeId: null,
    scopeName: 'Configuracion inferida',
    source: 'inferred',
  };
}

export async function buildProjectDashboard({ cloudId, projectKey, userId = null }) {
  const persisted = await getPersistedProjectIssues({ cloudId, projectKey });
  if (!persisted?.issues?.length) return null;

  const config = await resolveDashboardConfig({ userId, cloudId, projectKey, issues: persisted.issues });
  const issues = filterIssuesByScope(persisted.issues, config);
  const flowMetrics = calculateFlowMetrics({ issues, config });
  const leadTime = normalizeMetric(flowMetrics.leadTime || summarizeLeadTimeFromCurrentState(issues, config));
  const cycleTime = normalizeMetric(flowMetrics.cycleTime);
  const doneIssues = issues.filter((issue) => isDoneIssue(issue, config.doneStatuses));
  const wip = issues.filter((issue) => isInProgressIssue(issue, config.startStatuses, config.doneStatuses)).length;
  const hasStoryPoints = doneIssues.some((issue) => typeof issue.storyPoints === 'number');
  const velocity = doneIssues.reduce((sum, issue) => sum + (hasStoryPoints ? issue.storyPoints || 0 : 1), 0);
  const sprintMetrics = buildThroughputSeries(issues, config);
  const latestSyncRun = await prisma.syncRun.findFirst({
    where: {
      AND: [
        { imported: { path: ['cloudId'], equals: cloudId } },
        { imported: { path: ['projectKey'], equals: persisted.project.key } },
      ],
    },
    orderBy: { startedAt: 'desc' },
  }) || await prisma.syncRun.findFirst({
    where: { imported: { path: ['projectKey'], equals: persisted.project.key } },
    orderBy: { startedAt: 'desc' },
  });
  const changelogIssues = Number(latestSyncRun?.imported?.changelogIssues || 0);
  const importedSprints = Number(latestSyncRun?.imported?.sprints || 0);

  return {
    generatedAt: new Date().toISOString(),
    source: 'postgres-jira-sync',
    simulation: { tick: 0, refreshMs: 0 },
    project: {
      id: persisted.project.id,
      key: persisted.project.key,
      name: persisted.project.name,
    },
    board: { name: 'Proyecto Jira sincronizado' },
    analysis: {
      scopeId: config.scopeId,
      scopeName: config.scopeName,
      source: config.source,
      totalIssues: persisted.issues.length,
      visibleIssues: issues.length,
      startStatuses: config.startStatuses,
      doneStatuses: config.doneStatuses,
      labels: config.labels,
      issueTypes: config.issueTypes,
      dateFrom: config.dateFrom?.toISOString?.().slice(0, 10) || null,
      dateTo: config.dateTo?.toISOString?.().slice(0, 10) || null,
      percentileMarks: config.percentileMarks,
    },
    summary: {
      leadTime,
      cycleTime,
      wip,
      velocity,
      velocityUnit: hasStoryPoints ? 'pts' : 'issues',
      throughput: doneIssues.length,
      issues: issues.length,
      activeSprint: formatSyncDate(latestSyncRun?.finishedAt),
    },
    charts: {
      sprintMetrics: sprintMetrics.length ? sprintMetrics : [{ sprint: 'Actual', committed: issues.length, completed: doneIssues.length, wip, done: doneIssues.length }],
      throughput: sprintMetrics.map((item) => ({ sprint: item.sprint, issues: item.done })),
      statusBreakdown: statusBreakdown(issues),
    },
    recentIssues: recentIssues(issues),
    issues: issues.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      type: issue.type,
      team: 'Jira',
      points: issue.storyPoints ?? 0,
      assignee: issue.assignee,
      labels: issue.labels || [],
      sprint: issue.sprint,
      updatedAt: issue.updatedAt,
    })),
    warnings: [
      {
        title: 'Datos reales sincronizados',
        message: 'El dashboard se calcula desde PostgreSQL usando issues importadas desde Jira Cloud.',
      },
      {
        title: 'Configuracion de analisis aplicada',
        message: `${issues.length} de ${persisted.issues.length} issues entran en el ambito actual. Estados inicio: ${config.startStatuses.join(', ')}; final: ${config.doneStatuses.join(', ')}.`,
      },
      importedSprints > 0
        ? {
            title: 'Sprints Jira importados',
            message: `${importedSprints} sprints disponibles para agrupar Velocity por sprint real.`,
          }
        : {
            title: 'Velocity por periodo',
            message: 'No hay sprints asociados a issues; se agrupa por fecha de actualizacion como fallback.',
          },
      changelogIssues > 0
        ? {
            title: 'Changelog Jira importado',
            message: `${changelogIssues} issues incluyen historial de cambios de estado para calcular Lead/Cycle Time.`,
          }
        : {
            title: 'Historial de transiciones parcial',
            message: 'No se pudo importar changelog Jira; Lead/Cycle Time usa el fallback de estado actual.',
          },
    ],
  };
}
