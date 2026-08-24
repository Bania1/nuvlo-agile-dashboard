import { prisma } from '../db/prisma.js';
import { getLatestAtlassianSession, refreshAtlassianSession } from './authRepository.js';
import { jiraRequest } from './jiraClient.js';
import { decryptSecret } from '../utils/crypto.js';
import { setSyncStatus } from '../cache/redis.js';
import { logError, logInfo } from '../utils/logger.js';

const baseIssueFields = ['summary', 'issuetype', 'status', 'priority', 'assignee', 'created', 'updated', 'labels'];
const fieldCache = new Map();


function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isStoryPointsField(field) {
  const name = normalizeText(field.name);
  const id = normalizeText(field.id);
  return (
    id === 'storypoints' ||
    name.includes('story point') ||
    name.includes('story points') ||
    name.includes('story point estimate') ||
    name.includes('estimacion de puntos') ||
    name.includes('puntos de historia')
  );
}



function isSprintField(field) {
  const name = normalizeText(field.name);
  return name === 'sprint' || name === 'sprints';
}

async function getJiraFields({ cloudId, accessToken }) {
  if (fieldCache.has(cloudId)) return fieldCache.get(cloudId);
  const fields = await jiraRequest({ cloudId, accessToken, path: '/field' });
  fieldCache.set(cloudId, fields);
  return fields;
}

async function detectStoryPointsField({ cloudId, accessToken }) {
  const fields = await getJiraFields({ cloudId, accessToken });
  const field = fields.find(isStoryPointsField);
  return field?.id || null;
}

async function detectSprintField({ cloudId, accessToken }) {
  const fields = await getJiraFields({ cloudId, accessToken });
  const field = fields.find(isSprintField);
  return field?.id || null;
}

function parseStoryPoints(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJiraDate(value) {
  if (typeof value === 'number') return new Date(value < 1000000000000 ? value * 1000 : value);
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function mapStatusChangelogItem(history, item) {
  return {
    fromStatus: item.fromString || null,
    toStatus: item.toString || 'Unknown',
    happenedAt: parseJiraDate(history.created),
  };
}

function extractStatusTransitions(issueId, changeHistories = []) {
  return changeHistories
    .flatMap((history) =>
      (history.items || [])
        .filter((item) => item.fieldId === 'status' || normalizeText(item.field) === 'status')
        .map((item) => ({ issueId, ...mapStatusChangelogItem(history, item) })),
    )
    .sort((a, b) => a.happenedAt.getTime() - b.happenedAt.getTime());
}

async function fetchIssueChangelogs({ cloudId, accessToken, issueIdsOrKeys }) {
  if (!issueIdsOrKeys.length) return new Map();
  const byIssueId = new Map();
  let nextPageToken;

  do {
    const payload = await jiraRequest({
      cloudId,
      accessToken,
      path: '/changelog/bulkfetch',
      method: 'POST',
      body: {
        issueIdsOrKeys,
        fieldIds: ['status'],
        maxResults: 1000,
        ...(nextPageToken ? { nextPageToken } : {}),
      },
    });

    for (const issueLog of payload.issueChangeLogs || []) {
      byIssueId.set(String(issueLog.issueId), [
        ...(byIssueId.get(String(issueLog.issueId)) || []),
        ...(issueLog.changeHistories || []),
      ]);
    }
    nextPageToken = payload.nextPageToken;
  } while (nextPageToken);

  return new Map(
    [...byIssueId.entries()].map(([issueId, histories]) => [issueId, extractStatusTransitions(issueId, histories)]),
  );
}

async function fetchIssueChangelogsSafely({ cloudId, accessToken, issueIdsOrKeys }) {
  try {
    return await fetchIssueChangelogs({ cloudId, accessToken, issueIdsOrKeys });
  } catch (error) {
    logError('Jira changelog import skipped', error, { issues: issueIdsOrKeys.length });
    return new Map();
  }
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

async function getActiveAtlassianAccess(userId) {
  const atlassianSession = await getLatestAtlassianSession(userId);
  if (!atlassianSession) {
    const error = new Error('Atlassian session not found.');
    error.statusCode = 404;
    error.code = 'ATLASSIAN_SESSION_NOT_FOUND';
    throw error;
  }
  let activeSession = atlassianSession;
  if (activeSession.expiresAt && activeSession.expiresAt <= new Date()) {
    activeSession = await refreshAtlassianSession(activeSession);
  }
  return {
    atlassianSession: activeSession,
    accessToken: decryptSecret(activeSession.encryptedAccessToken),
  };
}



function mapBoard(board) {
  return {
    jiraId: Number(board.id),
    name: board.name || `Board ${board.id}`,
    type: board.type || 'unknown',
  };
}

function mapSprint(sprint) {
  return {
    jiraId: Number(sprint.id),
    name: sprint.name || `Sprint ${sprint.id}`,
    state: sprint.state || 'unknown',
    startDate: sprint.startDate ? parseJiraDate(sprint.startDate) : null,
    endDate: sprint.endDate ? parseJiraDate(sprint.endDate) : null,
    completeDate: sprint.completeDate ? parseJiraDate(sprint.completeDate) : null,
  };
}

async function fetchProjectBoards({ cloudId, accessToken, projectKey }) {
  const boards = [];
  let startAt = 0;
  let isLast = false;
  do {
    const payload = await jiraRequest({
      cloudId,
      accessToken,
      api: 'agile',
      path: '/board',
      searchParams: { projectKeyOrId: projectKey, startAt, maxResults: 50 },
    });
    boards.push(...(payload.values || []));
    isLast = payload.isLast ?? boards.length >= (payload.total || boards.length);
    startAt += payload.maxResults || 50;
  } while (!isLast);
  return boards.map(mapBoard);
}

async function fetchBoardSprints({ cloudId, accessToken, boardId }) {
  const sprints = [];
  let startAt = 0;
  let isLast = false;
  do {
    const payload = await jiraRequest({
      cloudId,
      accessToken,
      api: 'agile',
      path: `/board/${boardId}/sprint`,
      searchParams: { startAt, maxResults: 50, state: 'active,future,closed' },
    });
    sprints.push(...(payload.values || []));
    isLast = payload.isLast ?? sprints.length >= (payload.total || sprints.length);
    startAt += payload.maxResults || 50;
  } while (!isLast);
  return sprints.map(mapSprint);
}

async function fetchProjectBoardsAndSprintsSafely({ cloudId, accessToken, projectKey }) {
  try {
    const boards = await fetchProjectBoards({ cloudId, accessToken, projectKey });
    const sprintsByBoardJiraId = new Map();
    for (const board of boards) {
      const sprints = await fetchBoardSprints({ cloudId, accessToken, boardId: board.jiraId });
      sprintsByBoardJiraId.set(board.jiraId, sprints);
    }
    return { boards, sprintsByBoardJiraId };
  } catch (error) {
    logError('Jira agile board/sprint import skipped', error, { projectKey });
    return { boards: [], sprintsByBoardJiraId: new Map() };
  }
}


function sprintValuesFromIssue(issue, sprintFieldId) {
  const value = sprintFieldId ? issue.fields?.[sprintFieldId] : null;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mapSprintFromIssueField(value) {
  if (!value || typeof value !== 'object' || !value.id) return null;
  return {
    boardJiraId: Number(value.boardId || 0),
    sprint: mapSprint(value),
  };
}

function collectSprintsFromIssues(rawIssues, sprintFieldId) {
  const byBoard = new Map();
  for (const issue of rawIssues) {
    for (const value of sprintValuesFromIssue(issue, sprintFieldId)) {
      const mapped = mapSprintFromIssueField(value);
      if (!mapped) continue;
      const boardJiraId = mapped.boardJiraId;
      if (!byBoard.has(boardJiraId)) byBoard.set(boardJiraId, new Map());
      byBoard.get(boardJiraId).set(mapped.sprint.jiraId, mapped.sprint);
    }
  }
  return byBoard;
}

function parseSprintJiraId(value) {
  if (!value) return null;
  const sprint = Array.isArray(value) ? value.at(-1) : value;
  if (typeof sprint === 'object') return sprint.id ? Number(sprint.id) : null;
  const match = String(sprint).match(/id=([0-9]+)/);
  return match ? Number(match[1]) : null;
}

function appendCurrentStatusTransition(transitions, issue, existing) {
  const last = transitions.at(-1);
  if (last?.toStatus === issue.status) return transitions;
  return [
    ...transitions,
    {
      fromStatus: last?.toStatus || existing?.status || null,
      toStatus: issue.status,
      happenedAt: issue.jiraUpdatedAt,
    },
  ];
}

function mapIssue(issue, storyPointsFieldId, sprintFieldId, sprintIdByJiraId) {
  const fields = issue.fields || {};
  const sprintJiraId = parseSprintJiraId(sprintFieldId ? fields[sprintFieldId] : null);
  return {
    jiraId: issue.id,
    key: issue.key,
    summary: fields.summary || '(sin resumen)',
    issueType: fields.issuetype?.name || 'Issue',
    status: fields.status?.name || 'Unknown',
    statusCategory: fields.status?.statusCategory?.name || 'Unknown',
    priority: fields.priority?.name || null,
    assignee: fields.assignee?.displayName || null,
    labels: fields.labels || [],
    storyPoints: parseStoryPoints(storyPointsFieldId ? fields[storyPointsFieldId] : null),
    jiraCreatedAt: new Date(fields.created || Date.now()),
    jiraUpdatedAt: new Date(fields.updated || Date.now()),
    sprintId: sprintJiraId ? sprintIdByJiraId.get(sprintJiraId) || null : null,
  };
}

async function fetchProject({ cloudId, accessToken, projectKey }) {
  const project = await jiraRequest({
    cloudId,
    accessToken,
    path: `/project/${projectKey}`,
  });
  return {
    jiraId: project.id,
    key: project.key,
    name: project.name,
    avatarUrl: project.avatarUrls?.['48x48'] || project.avatarUrls?.['32x32'] || null,
  };
}

async function fetchProjectIssues({ cloudId, accessToken, projectKey, maxIssues = 100, storyPointsFieldId, sprintFieldId }) {
  const issues = [];
  let nextPageToken;

  do {
    const payload = await jiraRequest({
      cloudId,
      accessToken,
      path: '/search/jql',
      searchParams: {
        jql: `project = ${projectKey} ORDER BY updated DESC`,
        maxResults: Math.min(50, maxIssues - issues.length),
        fields: [...baseIssueFields, ...[storyPointsFieldId, sprintFieldId].filter(Boolean)],
        ...(nextPageToken ? { nextPageToken } : {}),
      },
    });
    issues.push(...(payload.issues || []));
    nextPageToken = payload.nextPageToken;
  } while (nextPageToken && issues.length < maxIssues);

  return issues;
}

export async function syncJiraProject({ userId, projectKey, maxIssues = 100 }) {
  const key = assertProjectKey(projectKey);
  const statusKey = `${userId}:${key}`;
  const syncRun = await prisma.syncRun.create({ data: { status: 'RUNNING', imported: { projectKey: key } } });
  await setSyncStatus(statusKey, { status: 'RUNNING', projectKey: key, syncRunId: syncRun.id });
  logInfo('Jira sync started', { projectKey: key, syncRunId: syncRun.id, maxIssues });

  try {
    const { atlassianSession, accessToken } = await getActiveAtlassianAccess(userId);
    const [storyPointsFieldId, sprintFieldId] = await Promise.all([
      detectStoryPointsField({ cloudId: atlassianSession.cloudId, accessToken }),
      detectSprintField({ cloudId: atlassianSession.cloudId, accessToken }),
    ]);
    const [projectPayload, rawIssues, agileData] = await Promise.all([
      fetchProject({ cloudId: atlassianSession.cloudId, accessToken, projectKey: key }),
      fetchProjectIssues({ cloudId: atlassianSession.cloudId, accessToken, projectKey: key, maxIssues, storyPointsFieldId, sprintFieldId }),
      fetchProjectBoardsAndSprintsSafely({ cloudId: atlassianSession.cloudId, accessToken, projectKey: key }),
    ]);
    const changelogTransitionsByIssueId = await fetchIssueChangelogsSafely({
      cloudId: atlassianSession.cloudId,
      accessToken,
      issueIdsOrKeys: rawIssues.map((issue) => issue.id),
    });
    const fallbackSprintsByBoardJiraId = collectSprintsFromIssues(rawIssues, sprintFieldId);

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.jiraProject.upsert({
        where: { cloudId_jiraId: { cloudId: atlassianSession.cloudId, jiraId: projectPayload.jiraId } },
        update: {
          key: projectPayload.key,
          name: projectPayload.name,
          avatarUrl: projectPayload.avatarUrl,
        },
        create: {
          cloudId: atlassianSession.cloudId,
          jiraId: projectPayload.jiraId,
          key: projectPayload.key,
          name: projectPayload.name,
          avatarUrl: projectPayload.avatarUrl,
        },
      });

      const sprintIdByJiraId = new Map();
      let importedBoards = 0;
      let importedSprints = 0;
      for (const boardPayload of agileData.boards) {
        const board = await tx.board.upsert({
          where: { jiraId_projectId: { jiraId: boardPayload.jiraId, projectId: project.id } },
          update: { name: boardPayload.name, type: boardPayload.type },
          create: { ...boardPayload, projectId: project.id },
        });
        importedBoards += 1;
        for (const sprintPayload of agileData.sprintsByBoardJiraId.get(boardPayload.jiraId) || []) {
          const sprint = await tx.sprint.upsert({
            where: { jiraId_boardId: { jiraId: sprintPayload.jiraId, boardId: board.id } },
            update: {
              name: sprintPayload.name,
              state: sprintPayload.state,
              startDate: sprintPayload.startDate,
              endDate: sprintPayload.endDate,
              completeDate: sprintPayload.completeDate,
            },
            create: { ...sprintPayload, boardId: board.id },
          });
          importedSprints += 1;
          sprintIdByJiraId.set(sprintPayload.jiraId, sprint.id);
        }
      }

      for (const [boardJiraId, sprintMap] of fallbackSprintsByBoardJiraId.entries()) {
        const board = await tx.board.upsert({
          where: { jiraId_projectId: { jiraId: boardJiraId, projectId: project.id } },
          update: { name: `Jira Board ${boardJiraId || 'detectado'}`, type: 'scrum' },
          create: { jiraId: boardJiraId, name: `Jira Board ${boardJiraId || 'detectado'}`, type: 'scrum', projectId: project.id },
        });
        if (!agileData.boards.some((boardPayload) => boardPayload.jiraId === boardJiraId)) importedBoards += 1;
        for (const sprintPayload of sprintMap.values()) {
          const sprint = await tx.sprint.upsert({
            where: { jiraId_boardId: { jiraId: sprintPayload.jiraId, boardId: board.id } },
            update: {
              name: sprintPayload.name,
              state: sprintPayload.state,
              startDate: sprintPayload.startDate,
              endDate: sprintPayload.endDate,
              completeDate: sprintPayload.completeDate,
            },
            create: { ...sprintPayload, boardId: board.id },
          });
          if (!sprintIdByJiraId.has(sprintPayload.jiraId)) importedSprints += 1;
          sprintIdByJiraId.set(sprintPayload.jiraId, sprint.id);
        }
      }

      let created = 0;
      let updated = 0;
      for (const rawIssue of rawIssues) {
        const issue = mapIssue(rawIssue, storyPointsFieldId, sprintFieldId, sprintIdByJiraId);
        const existing = await tx.issue.findUnique({
          where: { jiraId_projectId: { jiraId: issue.jiraId, projectId: project.id } },
        });
        const saved = await tx.issue.upsert({
          where: { jiraId_projectId: { jiraId: issue.jiraId, projectId: project.id } },
          update: { ...issue, projectId: project.id },
          create: { ...issue, projectId: project.id },
        });
        if (existing) updated += 1;
        else created += 1;

        const changelogTransitions = changelogTransitionsByIssueId.get(issue.jiraId) || [];
        const transitions = changelogTransitions.length
          ? appendCurrentStatusTransition(changelogTransitions, issue, existing)
          : !existing || existing.status !== issue.status
            ? [{ fromStatus: existing?.status || null, toStatus: issue.status, happenedAt: issue.jiraUpdatedAt }]
            : [];

        if (transitions.length) {
          await tx.issueTransition.deleteMany({ where: { issueId: saved.id } });
          await tx.issueTransition.createMany({
            data: transitions.map((transition) => ({
              issueId: saved.id,
              fromStatus: transition.fromStatus,
              toStatus: transition.toStatus,
              happenedAt: transition.happenedAt,
            })),
          });
        }
      }

      await tx.activityLog.create({
        data: {
          userId,
          eventType: 'SYNC',
          message: `Sincronizacion Jira completada para ${key}.`,
          metadata: { cloudId: atlassianSession.cloudId, projectKey: key, imported: rawIssues.length, created, updated, storyPointsFieldId, sprintFieldId, changelogIssues: changelogTransitionsByIssueId.size, boards: importedBoards, sprints: importedSprints },
        },
      });

      const imported = { cloudId: atlassianSession.cloudId, projectKey: key, issues: rawIssues.length, created, updated, storyPointsFieldId, sprintFieldId, changelogIssues: changelogTransitionsByIssueId.size, boards: importedBoards, sprints: importedSprints };
      await tx.syncRun.update({
        where: { id: syncRun.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), imported },
      });
      return { syncRunId: syncRun.id, project, imported };
    });

    await setSyncStatus(statusKey, { status: 'COMPLETED', projectKey: key, syncRunId: syncRun.id, imported: result.imported });
    logInfo('Jira sync completed', { projectKey: key, syncRunId: syncRun.id, imported: result.imported });
    return result;
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: error.message },
    });
    await setSyncStatus(statusKey, { status: 'FAILED', projectKey: key, syncRunId: syncRun.id, error: error.code || error.message });
    logError('Jira sync failed', error, { projectKey: key, syncRunId: syncRun.id });
    throw error;
  }
}

export async function getPersistedProjectIssues({ cloudId, projectKey }) {
  const project = await prisma.jiraProject.findFirst({
    where: { cloudId, key: assertProjectKey(projectKey) },
    include: {
      issues: {
        orderBy: { jiraUpdatedAt: 'desc' },
        take: 100,
        include: { sprint: true, transitions: { orderBy: { happenedAt: 'asc' } } },
      },
    },
  });
  if (!project) return null;
  return {
    project,
    issues: project.issues.map((issue) => ({
      id: issue.id,
      jiraId: issue.jiraId,
      key: issue.key,
      summary: issue.summary,
      type: issue.issueType,
      status: issue.status,
      statusCategory: issue.statusCategory,
      priority: issue.priority,
      assignee: issue.assignee || 'Sin asignar',
      storyPoints: issue.storyPoints,
      sprint: issue.sprint ? { id: issue.sprint.id, name: issue.sprint.name, state: issue.sprint.state } : null,
      createdAt: issue.jiraCreatedAt.toISOString(),
      updatedAt: issue.jiraUpdatedAt.toISOString(),
      transitions: issue.transitions.map((transition) => ({
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
        at: transition.happenedAt.toISOString(),
      })),
    })),
  };
}
