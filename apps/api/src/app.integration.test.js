import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getActiveAtlassianAccess: vi.fn(),
  getJsonCache: vi.fn(),
  getSyncStatus: vi.fn(),
  setJsonCache: vi.fn(),
  jiraRequest: vi.fn(),
  getPersistedProjectIssues: vi.fn(),
  syncJiraProject: vi.fn(),
  buildProjectDashboard: vi.fn(),
  getActivityLogs: vi.fn(),
  listProjectAlerts: vi.fn(),
  createProjectAlertRule: vi.fn(),
  updateProjectAlertRule: vi.fn(),
  deleteProjectAlertRule: vi.fn(),
  getProjectAnalysisScope: vi.fn(),
  updateProjectAnalysisScope: vi.fn(),
}));

vi.mock('./services/authRepository.js', () => ({
  getActiveAtlassianAccess: mocks.getActiveAtlassianAccess,
  getAuthenticatedUser: mocks.getAuthenticatedUser,
  persistAtlassianLogin: vi.fn(),
}));


vi.mock('./cache/redis.js', () => ({
  getJsonCache: mocks.getJsonCache,
  getSyncStatus: mocks.getSyncStatus,
  setJsonCache: mocks.setJsonCache,
}));

vi.mock('./services/jiraClient.js', () => ({
  jiraRequest: mocks.jiraRequest,
}));

vi.mock('./services/jiraSync.js', () => ({
  getPersistedProjectIssues: mocks.getPersistedProjectIssues,
  syncJiraProject: mocks.syncJiraProject,
}));

vi.mock('./services/projectDashboard.js', () => ({
  buildProjectDashboard: mocks.buildProjectDashboard,
}));

vi.mock('./services/activityRepository.js', () => ({
  getActivityLogs: mocks.getActivityLogs,
}));

vi.mock('./services/alertRepository.js', () => ({
  listProjectAlerts: mocks.listProjectAlerts,
  createProjectAlertRule: mocks.createProjectAlertRule,
  updateProjectAlertRule: mocks.updateProjectAlertRule,
  deleteProjectAlertRule: mocks.deleteProjectAlertRule,
}));

vi.mock('./services/analysisScope.js', () => ({
  getProjectAnalysisScope: mocks.getProjectAnalysisScope,
  updateProjectAnalysisScope: mocks.updateProjectAnalysisScope,
}));

process.env.JWT_SECRET = 'integration-test-secret-with-enough-length';
process.env.WEB_ORIGIN = 'http://localhost:5174';
process.env.NODE_ENV = 'test';

let createApp;
let signSession;

const user = {
  id: 'user-1',
  atlassianAccountId: 'atlassian-user-1',
  email: 'angel@example.test',
  displayName: 'Angel Test',
};

const atlassianSession = {
  id: 'session-1',
  userId: user.id,
  cloudId: 'cloud-1',
  siteName: 'Nuvlo Test Site',
  siteUrl: 'https://example.atlassian.net',
  encryptedAccessToken: 'encrypted-access-token',
  expiresAt: new Date(Date.now() + 60_000),
};

function authCookie() {
  return `nuvlo_session=${signSession(user)}`;
}

describe('Nuvlo API integration', () => {
  beforeAll(async () => {
    ({ createApp } = await import('./app.js'));
    ({ signSession } = await import('./security/session.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUser.mockResolvedValue(user);
    mocks.getActiveAtlassianAccess.mockResolvedValue({ atlassianSession, accessToken: 'access-token' });
    mocks.getJsonCache.mockResolvedValue(null);
    mocks.setJsonCache.mockResolvedValue(undefined);
    mocks.getPersistedProjectIssues.mockResolvedValue(null);
    mocks.getProjectAnalysisScope.mockResolvedValue({
      source: 'postgres',
      project: { id: 'project-1', key: 'TFG', name: 'TFG Agile Metrics Simulation' },
      scope: { startStatuses: ['In Progress'], doneStatuses: ['Done'], issueTypes: [], labels: [], percentileMarks: [50, 85] },
      options: { statuses: ['To Do', 'In Progress', 'Done'], issueTypes: ['Task'], labels: [], percentileMarks: [50, 75, 85, 90, 95] },
    });
    mocks.updateProjectAnalysisScope.mockResolvedValue({
      source: 'postgres',
      project: { id: 'project-1', key: 'TFG', name: 'TFG Agile Metrics Simulation' },
      scope: { startStatuses: ['Review'], doneStatuses: ['Done'], issueTypes: ['Task'], labels: [], percentileMarks: [50, 90] },
    });
  });

  it('serves health and demo dashboard without authentication', async () => {
    const app = createApp();

    await request(app)
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ name: 'Nuvlo API', status: 'ok' });
      });

    await request(app)
      .get('/api/dashboard/demo')
      .expect(200)
      .expect(({ body }) => {
        expect(body.project.name).toBeTruthy();
        expect(body.summary).toHaveProperty('wip');
      });
  });

  it('protects session endpoints and returns the authenticated user', async () => {
    const app = createApp();

    await request(app).get('/api/auth/me').expect(401);

    await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie())
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.displayName).toBe('Angel Test');
      });
  });

  it('requires CSRF for state-changing routes', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/logout')
      .set('Cookie', authCookie())
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toBe('CSRF_TOKEN_INVALID');
      });

    const csrfResponse = await agent
      .get('/api/auth/csrf')
      .set('Cookie', authCookie())
      .expect(200);
    const csrfToken = csrfResponse.body.csrfToken;
    const csrfCookie = csrfResponse.headers['set-cookie'].find((cookie) => cookie.startsWith('nuvlo_csrf='));

    await agent
      .post('/api/auth/logout')
      .set('Cookie', `${authCookie()}; ${csrfCookie.split(';')[0]}`)
      .set('x-csrf-token', csrfToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
      });
  });

  it('loads and updates persisted analysis scope with CSRF protection', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .get('/api/jira/projects/TFG/analysis-scope')
      .set('Cookie', authCookie())
      .expect(200)
      .expect(({ body }) => {
        expect(body.scope.startStatuses).toEqual(['In Progress']);
        expect(body.options.statuses).toContain('Done');
      });

    await agent
      .patch('/api/jira/projects/TFG/analysis-scope')
      .set('Cookie', authCookie())
      .send({ startStatuses: ['Review'], doneStatuses: ['Done'] })
      .expect(403);

    const csrfResponse = await agent
      .get('/api/auth/csrf')
      .set('Cookie', authCookie())
      .expect(200);
    const csrfCookie = csrfResponse.headers['set-cookie'].find((cookie) => cookie.startsWith('nuvlo_csrf='));

    await agent
      .patch('/api/jira/projects/TFG/analysis-scope')
      .set('Cookie', `${authCookie()}; ${csrfCookie.split(';')[0]}`)
      .set('x-csrf-token', csrfResponse.body.csrfToken)
      .send({ startStatuses: ['Review'], doneStatuses: ['Done'], issueTypes: ['Task'], percentileMarks: [50, 90] })
      .expect(200)
      .expect(({ body }) => {
        expect(body.scope.startStatuses).toEqual(['Review']);
        expect(body.scope.percentileMarks).toEqual([50, 90]);
      });

    expect(mocks.getProjectAnalysisScope).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', projectKey: 'TFG' }));
    expect(mocks.updateProjectAnalysisScope).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', projectKey: 'TFG' }));
  });
  it('loads Jira projects through OAuth session and stores cache', async () => {
    mocks.jiraRequest.mockResolvedValue({
      values: [
        {
          id: '10000',
          key: 'TFG',
          name: 'TFG Agile Metrics Simulation',
          projectTypeKey: 'software',
          simplified: true,
          avatarUrls: { '48x48': 'https://example.test/avatar.png' },
        },
      ],
    });
    const app = createApp();

    await request(app)
      .get('/api/jira/projects')
      .set('Cookie', authCookie())
      .expect(200)
      .expect(({ body }) => {
        expect(body.source).toBe('jira-cloud');
        expect(body.projects).toHaveLength(1);
        expect(body.projects[0]).toMatchObject({ key: 'TFG', name: 'TFG Agile Metrics Simulation' });
      });

    expect(mocks.jiraRequest).toHaveBeenCalledWith(expect.objectContaining({
      cloudId: 'cloud-1',
      accessToken: 'access-token',
      path: '/project/search',
    }));
    expect(mocks.setJsonCache).toHaveBeenCalledWith(expect.stringContaining('jira:projects:user-1:cloud-1'), expect.any(Object), 60);
  });
});

