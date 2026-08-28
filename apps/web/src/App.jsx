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
  const [analysisScope, setAnalysisScope] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertSummary, setAlertSummary] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);
  const [lastToastKey, setLastToastKey] = useState(null);
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(normalizePath(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadJiraProjects() {
      try {
        const payload = await fetchJson('/api/jira/projects');
        if (alive) setJiraProjects(payload);
      } catch (error) {
        if (error.status === 401) setAuthNotice('Tu sesion local ha caducado. Reconecta Jira para continuar con datos reales.');
        if (alive) setJiraProjects(null);
      }
    }
    loadJiraProjects();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadProjectData() {
      const projectKey = jiraProjects?.projects?.[0]?.key;
      if (!projectKey) return;
      try {
        const [issuesPayload, dashboardPayload] = await Promise.all([
          fetchJson(`/api/jira/projects/${projectKey}/issues`),
          fetchJson(`/api/jira/projects/${projectKey}/dashboard`),
        ]);
        if (alive) {
          setJiraIssues(issuesPayload);
          setProjectDashboard(dashboardPayload);
          loadAnalysisScopeFor(projectKey).catch(() => {});
        }
      } catch {
        if (alive) {
          setJiraIssues(null);
          setProjectDashboard(null);
        }
      }
    }
    loadProjectData();
    return () => {
      alive = false;
    };
  }, [jiraProjects]);

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

  const activeProjectKey = jiraProjects?.projects?.[0]?.key;
  const activeDashboard = projectDashboard || data;

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

  async function loadAlertSummary() {
    if (!activeProjectKey) {
      setAlertSummary(fallbackAlertSummary);
      setAnalysisScope(null);
      return fallbackAlertSummary;
    }
    try {
      const payload = await fetchJson(`/api/jira/projects/${activeProjectKey}/alerts`);
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
    } catch {
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
    ? jiraProjects.projects.map((project) => `${project.key} · ${project.name}`)
    : [data.project.name, 'Aplicacion Movil V2', 'Migracion Backend'];
  const view = resolveView(currentPath);

  async function loadJiraIssuesFor(projectKey) {
    if (!projectKey) return;
    const issuesPayload = await fetchJson(`/api/jira/projects/${projectKey}/issues`);
    setJiraIssues(issuesPayload);
    await loadProjectDashboardFor(projectKey);
    await loadAlertSummary();
    await loadAnalysisScopeFor(projectKey).catch(() => {});
  }

  async function loadProjectDashboardFor(projectKey) {
    if (!projectKey) return;
    const dashboardPayload = await fetchJson(`/api/jira/projects/${projectKey}/dashboard`);
    setProjectDashboard(dashboardPayload);
  }

  async function loadAnalysisScopeFor(projectKey) {
    if (!projectKey) return null;
    const payload = await fetchJson(`/api/jira/projects/${projectKey}/analysis-scope`);
    setAnalysisScope(payload);
    return payload;
  }

  async function refreshProjectAfterAnalysisChange() {
    if (!activeProjectKey) return;
    await loadProjectDashboardFor(activeProjectKey);
    await loadAlertSummary();
    await loadAnalysisScopeFor(activeProjectKey).catch(() => {});
  }

  // La sincronizacion real escribe en PostgreSQL; despues se recargan issues, dashboard y alertas desde la API.
  async function syncActiveProject() {
    if (!activeProjectKey) return;
    setSyncState({ status: 'RUNNING', projectKey: activeProjectKey });
    try {
      const payload = await postJson(`/api/jira/projects/${activeProjectKey}/sync`, { maxIssues: 100 });
      setSyncState(payload);
      await loadJiraIssuesFor(activeProjectKey);
    } catch (error) {
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
      <Sidebar currentPath={currentPath} importedProjects={importedProjects} onNavigate={navigateTo} isJiraConnected={Boolean(jiraProjects)} alertCount={alertSummary?.activeCount || 0} />
      <section className="workspace">
        <div className="view-transition" key={currentPath}>
          <Topbar data={activeDashboard} view={view} canSync={Boolean(activeProjectKey)} syncState={syncState} filtersOpen={filtersOpen} alertSummary={alertSummary} onToggleFilters={() => setFiltersOpen((open) => !open)} onSync={syncActiveProject} onNavigate={navigateTo} />
          {authNotice ? <div className="auth-notice"><span>{authNotice}</span><a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/atlassian/start`}>Reconectar Jira</a></div> : null}
          {toastAlert ? <AlertToast alert={toastAlert} onClose={() => setToastAlert(null)} /> : null}
          <ViewContent currentPath={currentPath} data={activeDashboard} demoData={data} jiraProjects={jiraProjects} jiraIssues={jiraIssues} syncState={syncState} filtersOpen={filtersOpen} analysisScope={analysisScope} onAnalysisChanged={refreshProjectAfterAnalysisChange} onAlertsChanged={loadAlertSummary} onLogout={logout} />
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

function ViewContent({ currentPath, data, demoData, jiraProjects, jiraIssues, syncState, filtersOpen, analysisScope, onAnalysisChanged, onAlertsChanged, onLogout }) {
  if (currentPath.startsWith('/dashboard/board')) return <BoardView data={demoData} jiraIssues={jiraIssues} syncState={syncState} />;
  if (currentPath.startsWith('/dashboard/alerts')) return <AlertsView data={data} projectKey={jiraProjects?.projects?.[0]?.key} onAlertsChanged={onAlertsChanged} />;
  if (currentPath.startsWith('/dashboard/activity')) return <ActivityView data={data} />;
  if (currentPath.startsWith('/dashboard/settings')) return <SettingsView data={data} jiraProjects={jiraProjects} jiraIssues={jiraIssues} syncState={syncState} analysisScope={analysisScope} onAnalysisChanged={onAnalysisChanged} onLogout={onLogout} />;
  return <DashboardView data={data} filtersOpen={filtersOpen} />;
}



