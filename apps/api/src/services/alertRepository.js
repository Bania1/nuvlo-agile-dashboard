import { prisma } from '../db/prisma.js';
import { evaluateAlertRule, metricLabel, normalizeMetricType, operatorLabel, supportedAlertOperators } from './alerts.js';
import { buildProjectDashboard } from './projectDashboard.js';

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

function dashboardMetrics(dashboard) {
  return {
    VELOCITY: Number(dashboard?.summary?.velocity),
    WIP: Number(dashboard?.summary?.wip),
    LEAD_TIME: Number(dashboard?.summary?.leadTime?.average),
    CYCLE_TIME: Number(dashboard?.summary?.cycleTime?.average),
    THROUGHPUT: Number(dashboard?.summary?.throughput),
  };
}

function priorityFor(rule, evaluation) {
  if (!evaluation.active) return 'Baja';
  const threshold = Math.abs(Number(rule.threshold) || 0);
  const value = Math.abs(Number(evaluation.value) || 0);
  if (!threshold) return 'Media';
  const ratio = value / threshold;
  if (ratio >= 1.5) return 'Alta';
  return 'Media';
}

function ruleTitle(rule) {
  return `${metricLabel(rule.metricType)} ${operatorLabel(rule.operator)} ${rule.threshold}`;
}

function ruleDetail(rule, evaluation) {
  if (evaluation.reason === 'METRIC_UNAVAILABLE') return 'Metrica no disponible con los datos sincronizados actuales.';
  return `Valor actual ${evaluation.value}; umbral ${evaluation.threshold}.`;
}

async function getProjectAndScope({ userId, cloudId, projectKey }) {
  const key = assertProjectKey(projectKey);
  const project = await prisma.jiraProject.findFirst({ where: { cloudId, key } });
  if (!project) {
    const error = new Error('Project must be synced before configuring alerts.');
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
      startStatuses: ['In Progress', 'Review'],
      doneStatuses: ['Done'],
      percentileMarks: [50, 85],
    },
  });

  return { project, scope };
}

async function persistEvaluation({ rule, evaluation }) {
  const activeEvent = await prisma.alertEvent.findFirst({
    where: { ruleId: rule.id, status: 'ACTIVE', resolvedAt: null },
    orderBy: { triggeredAt: 'desc' },
  });

  if (evaluation.active && !activeEvent) {
    return prisma.alertEvent.create({
      data: { ruleId: rule.id, status: 'ACTIVE', value: evaluation.value },
    });
  }

  if (!evaluation.active && activeEvent) {
    return prisma.alertEvent.update({
      where: { id: activeEvent.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), value: evaluation.value ?? activeEvent.value },
    });
  }

  return activeEvent;
}

function serializeRule(rule, evaluation, persistedEvent = null) {
  const latestEvent = persistedEvent || rule.events?.[0] || null;
  return {
    id: rule.id,
    metricType: rule.metricType,
    metricLabel: metricLabel(rule.metricType),
    operator: rule.operator,
    operatorLabel: operatorLabel(rule.operator),
    threshold: rule.threshold,
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    active: Boolean(evaluation.active),
    priority: priorityFor(rule, evaluation),
    title: ruleTitle(rule),
    detail: ruleDetail(rule, evaluation),
    currentValue: evaluation.value ?? null,
    latestEvent: latestEvent ? {
      id: latestEvent.id,
      status: latestEvent.status,
      value: latestEvent.value,
      triggeredAt: latestEvent.triggeredAt.toISOString(),
      resolvedAt: latestEvent.resolvedAt?.toISOString() || null,
    } : null,
    events: (rule.events || []).map((event) => ({
      id: event.id,
      status: event.status,
      value: event.value,
      triggeredAt: event.triggeredAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() || null,
    })),
  };
}

export async function listProjectAlerts({ userId, cloudId, projectKey }) {
  const { project, scope } = await getProjectAndScope({ userId, cloudId, projectKey });
  const dashboard = await buildProjectDashboard({ cloudId, projectKey: project.key });
  if (!dashboard) {
    const error = new Error('Project dashboard is not available yet.');
    error.statusCode = 404;
    error.code = 'PROJECT_DASHBOARD_NOT_SYNCED';
    throw error;
  }

  const metrics = dashboardMetrics(dashboard);
  const rules = await prisma.alertRule.findMany({
    where: { scopeId: scope.id },
    orderBy: { createdAt: 'desc' },
    include: { events: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
  });

  const evaluated = [];
  for (const rule of rules) {
    const evaluation = rule.enabled ? evaluateAlertRule(rule, metrics) : { active: false, reason: 'RULE_DISABLED' };
    const persistedEvent = await persistEvaluation({ rule, evaluation });
    evaluated.push(serializeRule(rule, evaluation, persistedEvent));
  }

  return {
    source: 'postgres',
    project: { id: project.id, key: project.key, name: project.name },
    scope: { id: scope.id, name: scope.name },
    metrics,
    rules: evaluated,
  };
}

async function getRuleForScope(scopeId, ruleId) {
  const rule = await prisma.alertRule.findFirst({
    where: { id: String(ruleId || ''), scopeId },
    include: { events: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
  });
  if (!rule) {
    const error = new Error('Alert rule not found.');
    error.statusCode = 404;
    error.code = 'ALERT_RULE_NOT_FOUND';
    throw error;
  }
  return rule;
}

export async function createProjectAlertRule({ userId, cloudId, projectKey, payload }) {
  const { project, scope } = await getProjectAndScope({ userId, cloudId, projectKey });
  const metricType = normalizeMetricType(payload?.metricType);
  const operator = String(payload?.operator || '').toUpperCase();
  const threshold = Number(payload?.threshold);

  if (!metricType) {
    const error = new Error('Unsupported alert metric type.');
    error.statusCode = 400;
    error.code = 'INVALID_ALERT_METRIC';
    throw error;
  }
  if (!supportedAlertOperators.includes(operator)) {
    const error = new Error('Unsupported alert operator.');
    error.statusCode = 400;
    error.code = 'INVALID_ALERT_OPERATOR';
    throw error;
  }
  if (!Number.isFinite(threshold)) {
    const error = new Error('Alert threshold must be numeric.');
    error.statusCode = 400;
    error.code = 'INVALID_ALERT_THRESHOLD';
    throw error;
  }

  const rule = await prisma.alertRule.create({
    data: { scopeId: scope.id, metricType, operator, threshold, enabled: payload?.enabled !== false },
    include: { events: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      eventType: 'ALERT',
      message: `Regla de alerta creada para ${project.key}.`,
      metadata: { projectKey: project.key, metricType, operator, threshold },
    },
  });

  const dashboard = await buildProjectDashboard({ cloudId, projectKey: project.key });
  const evaluation = dashboard ? evaluateAlertRule(rule, dashboardMetrics(dashboard)) : { active: false, reason: 'METRIC_UNAVAILABLE' };
  const persistedEvent = await persistEvaluation({ rule, evaluation });

  return serializeRule(rule, evaluation, persistedEvent);
}


export async function updateProjectAlertRule({ userId, cloudId, projectKey, ruleId, payload }) {
  const { project, scope } = await getProjectAndScope({ userId, cloudId, projectKey });
  await getRuleForScope(scope.id, ruleId);

  const data = {};
  if (typeof payload?.enabled === 'boolean') data.enabled = payload.enabled;
  if (!Object.keys(data).length) {
    const error = new Error('No supported alert updates were provided.');
    error.statusCode = 400;
    error.code = 'EMPTY_ALERT_UPDATE';
    throw error;
  }

  const rule = await prisma.alertRule.update({
    where: { id: String(ruleId) },
    data,
    include: { events: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      eventType: 'ALERT',
      message: `${rule.enabled ? 'Regla de alerta activada' : 'Regla de alerta pausada'} para ${project.key}.`,
      metadata: { projectKey: project.key, ruleId: rule.id, enabled: rule.enabled },
    },
  });

  const dashboard = await buildProjectDashboard({ cloudId, projectKey: project.key });
  const evaluation = rule.enabled && dashboard
    ? evaluateAlertRule(rule, dashboardMetrics(dashboard))
    : { active: false, reason: rule.enabled ? 'METRIC_UNAVAILABLE' : 'RULE_DISABLED' };
  const persistedEvent = await persistEvaluation({ rule, evaluation });
  return serializeRule(rule, evaluation, persistedEvent);
}

export async function deleteProjectAlertRule({ userId, cloudId, projectKey, ruleId }) {
  const { project, scope } = await getProjectAndScope({ userId, cloudId, projectKey });
  const rule = await getRuleForScope(scope.id, ruleId);
  await prisma.alertRule.delete({ where: { id: rule.id } });

  await prisma.activityLog.create({
    data: {
      userId,
      eventType: 'ALERT',
      message: `Regla de alerta eliminada para ${project.key}.`,
      metadata: { projectKey: project.key, ruleId: rule.id, metricType: rule.metricType },
    },
  });

  return { id: rule.id, deleted: true };
}
