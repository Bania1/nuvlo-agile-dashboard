import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDemoDataset, parseDemoCsv, rowsToDemoDataset, simulateDemoDataset } from '@nuvlo/shared';
import { env } from '../config/env.js';
import { calculateFlowMetrics } from './metrics.js';

// La demo offline intenta leer CSV reproducible; si no existe, genera un dataset determinista.
async function loadOfflineDataset() {
  try {
    const csv = await readFile(resolve('data/demo/nuvlo-demo-issues.csv'), 'utf8');
    return rowsToDemoDataset(parseDemoCsv(csv));
  } catch {
    return createDemoDataset();
  }
}

function summarizeBySprint(dataset) {
  return dataset.sprints.map((sprint) => {
    const issues = dataset.issues.filter((issue) => issue.sprintId === sprint.id);
    const completed = issues.filter((issue) => issue.status === 'Done');
    return {
      sprint: sprint.name.replace('Nuvlo ', ''),
      committed: issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0),
      completed: completed.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0),
      wip: issues.filter((issue) => ['In Progress', 'Review'].includes(issue.status)).length,
      done: completed.length,
    };
  });
}

function statusBreakdown(issues) {
  return ['To Do', 'In Progress', 'Review', 'Done'].map((status) => ({
    status,
    count: issues.filter((issue) => issue.status === status).length,
  }));
}

function recentIssues(issues) {
  return [...issues]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)
    .map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      type: issue.issueType,
      team: issue.team,
      points: issue.storyPoints,
      assignee: issue.assignee,
    }));
}

export async function buildDemoDashboard() {
  const tick = env.DEMO_FIXED_TICK ?? Math.floor(Date.now() / 5000) % 6;
  const baseDataset = await loadOfflineDataset();
  const dataset = simulateDemoDataset(baseDataset, tick);
  const metrics = calculateFlowMetrics({
    issues: dataset.issues,
    config: dataset.analysisScope,
  });
  const sprintMetrics = summarizeBySprint(dataset);
  const doneIssues = dataset.issues.filter((issue) => issue.status === 'Done');

  return {
    generatedAt: new Date().toISOString(),
    source: 'offline-csv',
    simulation: { tick, refreshMs: 5000 },
    project: dataset.project,
    board: dataset.board,
    summary: {
      leadTime: metrics.leadTime,
      cycleTime: metrics.cycleTime,
      wip: metrics.wip,
      velocity: metrics.velocity,
      throughput: doneIssues.length,
      issues: dataset.issues.length,
      activeSprint: dataset.sprints.at(-1)?.name,
    },
    charts: {
      sprintMetrics,
      throughput: sprintMetrics.map((item) => ({ sprint: item.sprint, issues: item.done })),
      statusBreakdown: statusBreakdown(dataset.issues),
    },
    recentIssues: recentIssues(dataset.issues),
    issues: dataset.issues.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      type: issue.issueType,
      team: issue.team,
      points: issue.storyPoints,
      assignee: issue.assignee,
      sprintId: issue.sprintId,
      updatedAt: issue.updatedAt,
    })),
    warnings: [
      {
        title: 'Demo offline',
        message: 'Datos leidos desde CSV local y simulados sin llamadas a Jira.',
      },
      {
        title: 'Actualizacion simulada',
        message: `Tick ${tick}/5: algunos issues cambian de estado cada 5 segundos.`,
      },
    ],
  };
}
