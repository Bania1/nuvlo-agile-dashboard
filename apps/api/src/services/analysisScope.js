import { prisma } from '../db/prisma.js';

const defaultStartStatuses = ['In Progress', 'Review'];
const defaultDoneStatuses = ['Done'];
const defaultPercentiles = [50, 85];

function normalizeText(value) {
  return String(value || '').trim();
}

function uniqueClean(values, { max = 20 } = {}) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeText).filter(Boolean))].slice(0, max);
}

function normalizePercentiles(values) {
  if (!Array.isArray(values)) return defaultPercentiles;
  const normalized = [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value > 0 && value < 100))]
    .sort((a, b) => a - b)
    .slice(0, 4);
  return normalized.length ? normalized : defaultPercentiles;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error('Analysis date range is invalid.');
    error.statusCode = 400;
    error.code = 'INVALID_ANALYSIS_DATE';
    throw error;
  }
  return date;
}

function serializeDate(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function serializeScope(scope, extras = {}) {
  return {
    id: scope.id,
    name: scope.name,
    projectId: scope.projectId,
    boardJiraId: scope.boardJiraId,
    sprintJiraId: scope.sprintJiraId,
    labels: scope.labels || [],
    issueTypes: scope.issueTypes || [],
    dateFrom: serializeDate(scope.dateFrom),
    dateTo: serializeDate(scope.dateTo),
    startStatuses: scope.startStatuses || defaultStartStatuses,
    doneStatuses: scope.doneStatuses || defaultDoneStatuses,
    effortField: scope.effortField || null,
    percentileMarks: scope.percentileMarks?.length ? scope.percentileMarks : defaultPercentiles,
    lastSyncAt: scope.lastSyncAt?.toISOString() || null,
    ...extras,
  };
}

function assertProjectKey(projectKey) {
  const key = String(projectKey || '').toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,20}$/.test(key)) {
    const error = new Error('Invalid Jira project key.');
    error.statusCode = 400;
    error.code = 'INVALID_PROJECT_KEY';
    throw error;
  }
  return key;
}

export async function getProjectAndAnalysisScope({ userId, cloudId, projectKey }) {
  const key = assertProjectKey(projectKey);
  const project = await prisma.jiraProject.findFirst({ where: { cloudId, key } });
  if (!project) {
    const error = new Error('Project must be synced before configuring analysis.');
    error.statusCode = 404;
    error.code = 'PROJECT_NOT_SYNCED';
    throw error;
  }

  const scope = await prisma.analysisScope.upsert({
    where: { id: `${userId}:${project.id}:default` },
    update: { projectId: project.id },
    create: {
      id: `${userId}:${project.id}:default`,
      userId,
      projectId: project.id,
      name: `${project.key} - Analisis principal`,
      labels: [],
      issueTypes: [],
      startStatuses: defaultStartStatuses,
      doneStatuses: defaultDoneStatuses,
      percentileMarks: defaultPercentiles,
    },
  });

  return { project, scope };
}

export function scopeConfig(scope) {
  return {
    labels: scope.labels || [],
    issueTypes: scope.issueTypes || [],
    dateFrom: scope.dateFrom || null,
    dateTo: scope.dateTo || null,
    startStatuses: scope.startStatuses?.length ? scope.startStatuses : defaultStartStatuses,
    doneStatuses: scope.doneStatuses?.length ? scope.doneStatuses : defaultDoneStatuses,
    percentileMarks: scope.percentileMarks?.length ? scope.percentileMarks : defaultPercentiles,
  };
}

export async function getProjectAnalysisScope({ userId, cloudId, projectKey }) {
  const { project, scope } = await getProjectAndAnalysisScope({ userId, cloudId, projectKey });
  const issues = await prisma.issue.findMany({
    where: { projectId: project.id },
    select: { status: true, issueType: true, labels: true },
    orderBy: { jiraUpdatedAt: 'desc' },
    take: 250,
  });

  return {
    source: 'postgres',
    project: { id: project.id, key: project.key, name: project.name },
    scope: serializeScope(scope),
    options: {
      statuses: [...new Set(issues.map((issue) => issue.status).filter(Boolean))].sort(),
      issueTypes: [...new Set(issues.map((issue) => issue.issueType).filter(Boolean))].sort(),
      labels: [...new Set(issues.flatMap((issue) => issue.labels || []).filter(Boolean))].sort(),
      percentileMarks: [50, 75, 85, 90, 95],
    },
  };
}

export async function updateProjectAnalysisScope({ userId, cloudId, projectKey, payload }) {
  const { project, scope } = await getProjectAndAnalysisScope({ userId, cloudId, projectKey });
  const startStatuses = uniqueClean(payload?.startStatuses);
  const doneStatuses = uniqueClean(payload?.doneStatuses);
  if (!startStatuses.length || !doneStatuses.length) {
    const error = new Error('Start and done statuses are required.');
    error.statusCode = 400;
    error.code = 'INVALID_ANALYSIS_STATUSES';
    throw error;
  }

  const dateFrom = parseOptionalDate(payload?.dateFrom);
  const dateTo = parseOptionalDate(payload?.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('Analysis dateFrom cannot be after dateTo.');
    error.statusCode = 400;
    error.code = 'INVALID_ANALYSIS_DATE_RANGE';
    throw error;
  }

  const updated = await prisma.analysisScope.update({
    where: { id: scope.id },
    data: {
      labels: uniqueClean(payload?.labels),
      issueTypes: uniqueClean(payload?.issueTypes),
      dateFrom,
      dateTo,
      startStatuses,
      doneStatuses,
      effortField: normalizeText(payload?.effortField) || null,
      percentileMarks: normalizePercentiles(payload?.percentileMarks),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      eventType: 'USER_ACTION',
      message: `Configuracion de analisis actualizada para ${project.key}.`,
      metadata: { projectKey: project.key, scopeId: updated.id },
    },
  });

  return {
    source: 'postgres',
    project: { id: project.id, key: project.key, name: project.name },
    scope: serializeScope(updated),
  };
}
