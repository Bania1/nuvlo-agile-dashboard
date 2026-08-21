import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createDemoDataset, parseDemoCsv, rowsToDemoDataset } from '@nuvlo/shared';

const prisma = new PrismaClient();

async function loadDataset() {
  try {
    const csv = await readFile(resolve('data/demo/nuvlo-demo-issues.csv'), 'utf8');
    return rowsToDemoDataset(parseDemoCsv(csv));
  } catch {
    return createDemoDataset();
  }
}

async function main() {
  const dataset = await loadDataset();

  const user = await prisma.user.upsert({
    where: { atlassianAccountId: 'demo-account' },
    update: { email: 'demo@nuvlo.local', displayName: 'Demo Nuvlo' },
    create: { atlassianAccountId: 'demo-account', email: 'demo@nuvlo.local', displayName: 'Demo Nuvlo' },
  });

  const project = await prisma.jiraProject.upsert({
    where: { cloudId_jiraId: { cloudId: dataset.project.cloudId, jiraId: dataset.project.jiraId } },
    update: { key: dataset.project.key, name: dataset.project.name },
    create: dataset.project,
  });

  const board = await prisma.board.upsert({
    where: { jiraId_projectId: { jiraId: dataset.board.jiraId, projectId: project.id } },
    update: { name: dataset.board.name, type: dataset.board.type },
    create: { ...dataset.board, projectId: project.id },
  });

  const sprintByDemoId = new Map();
  for (const sprint of dataset.sprints) {
    const saved = await prisma.sprint.upsert({
      where: { jiraId_boardId: { jiraId: sprint.jiraId, boardId: board.id } },
      update: {
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completeDate: sprint.completeDate,
      },
      create: {
        jiraId: sprint.jiraId,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completeDate: sprint.completeDate,
        boardId: board.id,
      },
    });
    sprintByDemoId.set(sprint.id, saved.id);
  }

  for (const issue of dataset.issues) {
    const saved = await prisma.issue.upsert({
      where: { jiraId_projectId: { jiraId: issue.jiraId, projectId: project.id } },
      update: {
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        status: issue.status,
        statusCategory: issue.statusCategory,
        priority: issue.priority,
        assignee: issue.assignee,
        labels: issue.labels,
        storyPoints: issue.storyPoints,
        jiraCreatedAt: issue.createdAt,
        jiraUpdatedAt: issue.updatedAt,
        sprintId: sprintByDemoId.get(issue.sprintId),
      },
      create: {
        jiraId: issue.jiraId,
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        status: issue.status,
        statusCategory: issue.statusCategory,
        priority: issue.priority,
        assignee: issue.assignee,
        labels: issue.labels,
        storyPoints: issue.storyPoints,
        jiraCreatedAt: issue.createdAt,
        jiraUpdatedAt: issue.updatedAt,
        projectId: project.id,
        sprintId: sprintByDemoId.get(issue.sprintId),
      },
    });

    await prisma.issueTransition.deleteMany({ where: { issueId: saved.id } });
    if (issue.transitions.length > 0) {
      await prisma.issueTransition.createMany({
        data: issue.transitions.map((transition) => ({
          issueId: saved.id,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          happenedAt: transition.at,
        })),
      });
    }
  }

  await prisma.analysisScope.upsert({
    where: { id: 'demo-scope-main' },
    update: {
      userId: user.id,
      projectId: project.id,
      name: dataset.analysisScope.name,
      issueTypes: dataset.analysisScope.issueTypes,
      startStatuses: dataset.analysisScope.startStatuses,
      doneStatuses: dataset.analysisScope.doneStatuses,
      effortField: dataset.analysisScope.effortField,
      percentileMarks: dataset.analysisScope.percentileMarks,
    },
    create: {
      id: 'demo-scope-main',
      userId: user.id,
      projectId: project.id,
      name: dataset.analysisScope.name,
      labels: [],
      issueTypes: dataset.analysisScope.issueTypes,
      startStatuses: dataset.analysisScope.startStatuses,
      doneStatuses: dataset.analysisScope.doneStatuses,
      effortField: dataset.analysisScope.effortField,
      percentileMarks: dataset.analysisScope.percentileMarks,
    },
  });

  console.log(`Seed demo ready from offline CSV: ${dataset.issues.length} issues, ${dataset.sprints.length} sprints`);
}

main().finally(async () => prisma.$disconnect());
