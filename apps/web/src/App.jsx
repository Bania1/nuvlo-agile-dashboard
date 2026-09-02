import { useEffect, useMemo, useState } from 'react';
import { fetchJson, postJson } from './lib/api.js';
import { normalizePath, resolveView } from './lib/navigation.js';
import { Sidebar, Topbar } from './components/Shell.jsx';
import { AlertsView } from './views/AlertsView.jsx';
import { ActivityView } from './views/ActivityView.jsx';
import { BoardView } from './views/BoardView.jsx';
import { DashboardView } from './views/DashboardView.jsx';
import { Landing } from './views/Landing.jsx';
import { SettingsView } from './views/SettingsView.jsx';

export function App() {
  const isDashboard = window.location.pathname.startsWith('/dashboard');
  return isDashboard ? <DashboardApp /> : <Landing />;
}

function DashboardApp() {
  // Estado raiz: mantiene juntas demo offline, sesion Jira, sincronizacion y navegacion interna.
  const [data, setData] = useState(null);
  const [jiraProjects, setJiraProjects] = useState(null);
  const [jiraIssues, setJiraIssues] = useState(null);
  const [projectDashboard, setProjectDashboard] = useState(null);
  const [activeProjectKey, setActiveProjectKey] = useState(() => window.localStorage.getItem('nuvlo_active_project') || '');
  const [chartPeriod, setChartPeriod] = useState(() => window.localStorage.getItem('nuvlo_chart_period') || '8');
  const [analysisScope, setAnalysisScope] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertSummary, setAlertSummary] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);
  const [lastToastKey, setLastToastKey] = useState(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(normalizePath(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function shouldRedirectToLogin(error) {
    return error?.status === 401 && ['INVALID_SESSION', 'ATLASSIAN_REFRESH_TOKEN_MISSING'].includes(error.payload?.error || error.payload?.code);
  }

  function handleAuthExpired() {
    window.sessionStorage.setItem('nuvlo_auth_expired_notice', 'Tu sesion ha caducado. Vuelve a conectar Jira para continuar.');
    setJiraProjects(null);
    setJiraIssues(null);
    setProjectDashboard(null);
    setSyncState(null);
    setAlertSummary(null);
    setAnalysisScope(null);
    setActiveProjectKey('');
    window.localStorage.removeItem('nuvlo_active_project');
    window.location.assign('/');
  }

  useEffect(() => {
    let alive = true;
    async function loadJiraProjects() {
      try {
        const payload = await fetchJson('/api/jira/projects');
        if (alive) setJiraProjects(payload);
      } catch (error) {
        if (shouldRedirectToLogin(error)) {
          handleAuthExpired();
          return;
        }
        if (alive) setJiraProjects(null);
      }
    }
    loadJiraProjects();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const projects = jiraProjects?.projects || [];
    if (!projects.length) {
      setActiveProjectKey('');
      return;
    }
    const stored = window.localStorage.getItem('nuvlo_active_project');
    const nextProject = projects.some((project) => project.key === activeProjectKey)
      ? activeProjectKey
      : projects.some((project) => project.key === stored)
        ? stored
        : projects[0].key;
    if (nextProject !== activeProjectKey) setActiveProjectKey(nextProject);
  }, [jiraProjects, activeProjectKey]);

  useEffect(() => {
    let alive = true;
    async function loadProjectData() {
      if (!activeProjectKey) return;
      setIsProjectLoading(true);
      try {
        const [issuesPayload, dashboardPayload] = await Promise.all([
          fetchJson(`/api/jira/projects/${activeProjectKey}/issues`),
          fetchJson(`/api/jira/projects/${activeProjectKey}/dashboard`),
        ]);
        if (alive) {
          setJiraIssues(issuesPayload);
          setProjectDashboard(dashboardPayload);
          loadAnalysisScopeFor(activeProjectKey).catch((error) => {
            if (shouldRedirectToLogin(error)) handleAuthExpired();
          });
        }
      } catch (error) {
        if (shouldRedirectToLogin(error)) {
          handleAuthExpired();
          return;
        }
        if (alive) {
          setJiraIssues(null);
          setProjectDashboard(null);
        }
      } finally {
        if (alive) setIsProjectLoading(false);
      }
    }
    loadProjectData();
    return () => {
      alive = false;
    };
  }, [activeProjectKey]);

  useEffect(() => {
    let alive = true;
    async function loadDemo() {
      try {
        const payload = await fetchJson('/api/dashboard/demo');
        if (alive) setData(payload);
      } catch {
        if (alive) setData(null);
      }
    }
    loadDemo();
    const interval = window.setInterval(loadDemo, 5000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const activeDashboard = projectDashboard || data;
  const hasRealProjectData = Boolean(projectDashboard && jiraIssues?.issues?.length);

  // Si no hay proyecto Jira conectado, la UI conserva una experiencia demostrable con avisos simulados.
  const fallbackAlertSummary = useMemo(() => {
    if (!data) return null;
    const alerts = [
      { id: 'demo-wip', priority: 'Alta', title: 'WIP por encima del objetivo', detail: `${data.summary.wip} issues activos en ${data.summary.activeSprint}`, active: true },
      { id: 'demo-lead', priority: 'Media', title: 'Lead Time elevado', detail: `${data.summary.leadTime.average} dias de media frente al objetivo demo de 10 dias`, active: true },
    ];
    return {
      source: 'fallback',
      activeCount: alerts.length,
      activeAlerts: alerts,
      rules: alerts,
    };
  }, [data]);

  async function loadAlertSummary(projectKey = activeProjectKey) {
    if (!projectKey) {
      setAlertSummary(fallbackAlertSummary);
      setAnalysisScope(null);
      return fallbackAlertSummary;
    }
    try {
      const payload = await fetchJson(`/api/jira/projects/${projectKey}/alerts`);
      const rules = payload.rules || [];
      const activeAlerts = rules.filter((rule) => rule.active);
      const nextSummary = {
        source: payload.source || 'postgres',
        activeCount: activeAlerts.length,
        activeAlerts,
        rules,
      };
      setAlertSummary(nextSummary);
      return nextSummary;
    } catch (error) {
      if (shouldRedirectToLogin(error)) {
        handleAuthExpired();
        return null;
      }
      setAlertSummary(fallbackAlertSummary);
      return fallbackAlertSummary;
    }
  }

  useEffect(() => {
    if (!data) return;
    loadAlertSummary();
  }, [activeProjectKey, activeDashboard?.summary?.wip, activeDashboard?.summary?.velocity, fallbackAlertSummary]);

  useEffect(() => {
    const firstAlert = alertSummary?.activeAlerts?.[0];
    const toastKey = firstAlert ? `${firstAlert.id}:${firstAlert.currentValue ?? firstAlert.detail}` : null;
    if (!firstAlert || toastKey === lastToastKey) return;
    setLastToastKey(toastKey);
    setToastAlert(firstAlert);
    const timeout = window.setTimeout(() => setToastAlert(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [alertSummary, lastToastKey]);

  if (!data) {
    return <main className="dashboard-shell"><p className="loading">Cargando demo offline...</p></main>;
  }

  const importedProjects = jiraProjects?.projects?.length
    ? jiraProjects.projects
    : [{ key: 'DEMO', name: data.project.name }, { key: 'APP', name: 'Aplicacion Movil V2' }, { key: 'MIG', name: 'Migracion Backend' }];
  const view = resolveView(currentPath, { isJiraConnected: Boolean(jiraProjects && activeProjectKey) });

  async function loadJiraIssuesFor(projectKey) {
    if (!projectKey) return;
    try {
      const issuesPayload = await fetchJson(`/api/jira/projects/${projectKey}/issues`);
      setJiraIssues(issuesPayload);
      await loadProjectDashboardFor(projectKey);
      await loadAlertSummary(projectKey);
      await loadAnalysisScopeFor(projectKey).catch((error) => {
        if (shouldRedirectToLogin(error)) handleAuthExpired();
      });
    } catch (error) {
      if (shouldRedirectToLogin(error)) handleAuthExpired();
      else throw error;
    }
  }

  async function loadProjectDashboardFor(projectKey) {
    if (!projectKey) return;
    try {
      const dashboardPayload = await fetchJson(`/api/jira/projects/${projectKey}/dashboard`);
      setProjectDashboard(dashboardPayload);
    } catch (error) {
      if (shouldRedirectToLogin(error)) handleAuthExpired();
      else throw error;
    }
  }

  function selectProject(projectKey) {
    if (!projectKey || projectKey === activeProjectKey) return;
    window.localStorage.setItem('nuvlo_active_project', projectKey);
    setActiveProjectKey(projectKey);
    setIsProjectLoading(true);
    setAnalysisScope(null);
    setAlertSummary(null);
    setSyncState(null);
  }

  function updateChartPeriod(value) {
    window.localStorage.setItem('nuvlo_chart_period', value);
    setChartPeriod(value);
  }

  async function loadAnalysisScopeFor(projectKey) {
    if (!projectKey) return null;
    try {
      const payload = await fetchJson(`/api/jira/projects/${projectKey}/analysis-scope`);
      setAnalysisScope(payload);
      return payload;
    } catch (error) {
      if (shouldRedirectToLogin(error)) handleAuthExpired();
      throw error;
    }
  }

  async function refreshProjectAfterAnalysisChange() {
    if (!activeProjectKey) return;
    await loadProjectDashboardFor(activeProjectKey);
    await loadAlertSummary(activeProjectKey);
    await loadAnalysisScopeFor(activeProjectKey).catch(() => {});
  }

  // La sincronizacion real escribe en PostgreSQL; despues se recargan issues, dashboard y alertas desde la API.
  async function syncActiveProject() {
    if (!activeProjectKey) return;
    setSyncState({ status: 'RUNNING', projectKey: activeProjectKey });
    try {
      const payload = await postJson(`/api/jira/projects/${activeProjectKey}/sync`, { maxIssues: 200 });
      setSyncState(payload);
      await loadJiraIssuesFor(activeProjectKey);
    } catch (error) {
      if (shouldRedirectToLogin(error)) {
        handleAuthExpired();
        return;
      }
      setSyncState({ status: 'FAILED', projectKey: activeProjectKey, error: error.message });
    }
  }

  async function logout() {
    try {
      await postJson('/api/auth/logout');
    } catch {
      // If the server session already expired, still clear local UI state.
    }
    setJiraProjects(null);
    setJiraIssues(null);
    setProjectDashboard(null);
    setSyncState(null);
    setAlertSummary(fallbackAlertSummary);
    setAnalysisScope(null);
    setActiveProjectKey('');
    window.localStorage.removeItem('nuvlo_active_project');
  }

  function navigateTo(event, href) {
    event.preventDefault();
    const nextPath = normalizePath(href);
    if (nextPath === currentPath) return;
    window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
  }

  return (
    <main className="dashboard-shell">
      <Sidebar currentPath={currentPath} importedProjects={importedProjects} activeProjectKey={activeProjectKey} onProjectSelect={selectProject} onNavigate={navigateTo} isJiraConnected={Boolean(jiraProjects)} alertCount={alertSummary?.activeCount || 0} />
      <section className="workspace">
        <div className={`view-transition ${isProjectLoading ? 'is-project-loading' : ''}`} key={currentPath}>
          <Topbar data={activeDashboard} view={view} canSync={Boolean(activeProjectKey)} syncState={syncState} filtersOpen={filtersOpen} alertSummary={alertSummary} chartPeriod={chartPeriod} onChartPeriodChange={updateChartPeriod} onToggleFilters={() => setFiltersOpen((open) => !open)} onSync={syncActiveProject} onNavigate={navigateTo} />
          {isProjectLoading ? <p className="project-loading">Actualizando vista para {activeProjectKey}...</p> : null}
          {toastAlert ? <AlertToast alert={toastAlert} onClose={() => setToastAlert(null)} /> : null}
          <ViewContent currentPath={currentPath} data={activeDashboard} demoData={data} activeProjectKey={activeProjectKey} jiraProjects={jiraProjects} jiraIssues={jiraIssues} hasRealProjectData={hasRealProjectData} syncState={syncState} filtersOpen={filtersOpen} chartPeriod={chartPeriod} analysisScope={analysisScope} onAnalysisChanged={refreshProjectAfterAnalysisChange} onAlertsChanged={loadAlertSummary} onLogout={logout} />
        </div>
      </section>
    </main>
  );
}

function AlertToast({ alert, onClose }) {
  return (
    <aside className="alert-toast" role="status">
      <div>
        <span>{alert.priority || 'Aviso'}</span>
        <strong>{alert.title}</strong>
        <p>{alert.detail}</p>
      </div>
      <button type="button" onClick={onClose}>Cerrar</button>
    </aside>
  );
}

function ViewContent({ currentPath, data, demoData, activeProjectKey, jiraProjects, jiraIssues, hasRealProjectData, syncState, filtersOpen, chartPeriod, analysisScope, onAnalysisChanged, onAlertsChanged, onLogout }) {
  if (currentPath.startsWith('/dashboard/board')) return <BoardView data={demoData} jiraIssues={jiraIssues} hasRealProjectData={hasRealProjectData} syncState={syncState} />;
  if (currentPath.startsWith('/dashboard/alerts')) return <AlertsView data={data} projectKey={activeProjectKey} onAlertsChanged={onAlertsChanged} />;
  if (currentPath.startsWith('/dashboard/activity')) return <ActivityView data={data} />;
  if (currentPath.startsWith('/dashboard/settings')) return <SettingsView data={data} projectKey={activeProjectKey} jiraProjects={jiraProjects} jiraIssues={jiraIssues} syncState={syncState} analysisScope={analysisScope} onAnalysisChanged={onAnalysisChanged} onLogout={onLogout} />;
  return <DashboardView data={data} filtersOpen={filtersOpen} chartPeriod={chartPeriod} />;
}



