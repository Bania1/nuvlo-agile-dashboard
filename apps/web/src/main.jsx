import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Cloud,
  Filter,
  Gauge,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './styles.css';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (path) => path === '/dashboard' },
  { href: '/dashboard/board', label: 'Tablero', icon: GitBranch },
  { href: '/dashboard/alerts', label: 'Alertas', icon: Bell },
  { href: '/dashboard/activity', label: 'Actividad', icon: Activity },
  { href: '/dashboard/settings', label: 'Configuracion', icon: Settings },
];

function App() {
  const isDashboard = window.location.pathname.startsWith('/dashboard');
  return isDashboard ? <DashboardApp /> : <Landing />;
}

function Landing() {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <div className="brand-mark"><Cloud size={26} /> Nuvlo</div>
        <p className="eyebrow">Nube + flujo para equipos agiles</p>
        <h1>Metricas claras para entender como avanza tu trabajo en Jira.</h1>
        <p className="lead">
          Nuvlo conectara con Atlassian mediante OAuth, sincronizara datos de Jira Cloud y
          mostrara Velocity, WIP, Lead Time y Cycle Time con trazabilidad del analisis.
        </p>
        <div className="actions">
          <a className="primary-button" href={`${apiUrl}/api/auth/atlassian/start`}>
            Conectar con Jira
          </a>
          <a className="secondary-button" href="/dashboard">Ver demo local</a>
        </div>
      </section>
    </main>
  );
}

function DashboardApp() {
  const [data, setData] = useState(null);
  const [jiraProjects, setJiraProjects] = useState(null);
  const [jiraIssues, setJiraIssues] = useState(null);
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
        const response = await fetch(`${apiUrl}/api/jira/projects`, { credentials: 'include' });
        if (!response.ok) return;
        const payload = await response.json();
        if (alive) setJiraProjects(payload);
      } catch {
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
    async function loadJiraIssues() {
      const projectKey = jiraProjects?.projects?.[0]?.key;
      if (!projectKey) return;
      try {
        const response = await fetch(`${apiUrl}/api/jira/projects/${projectKey}/issues`, { credentials: 'include' });
        if (!response.ok) return;
        const payload = await response.json();
        if (alive) setJiraIssues(payload);
      } catch {
        if (alive) setJiraIssues(null);
      }
    }
    loadJiraIssues();
    return () => {
      alive = false;
    };
  }, [jiraProjects]);

  useEffect(() => {
    let alive = true;
    async function loadDemo() {
      try {
        const response = await fetch(`${apiUrl}/api/dashboard/demo`, { credentials: 'include' });
        const payload = await response.json();
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

  if (!data) {
    return <main className="dashboard-shell"><p className="loading">Cargando demo offline...</p></main>;
  }

  const importedProjects = jiraProjects?.projects?.length
    ? jiraProjects.projects.map((project) => `${project.key} · ${project.name}`)
    : [data.project.name, 'Aplicacion Movil V2', 'Migracion Backend'];
  const view = resolveView(currentPath);

  function navigateTo(event, href) {
    event.preventDefault();
    const nextPath = normalizePath(href);
    if (nextPath === currentPath) return;
    window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
  }

  return (
    <main className="dashboard-shell">
      <Sidebar currentPath={currentPath} importedProjects={importedProjects} onNavigate={navigateTo} />
      <section className="workspace">
        <div className="view-transition" key={currentPath}>
          <Topbar data={data} view={view} />
          <ViewContent currentPath={currentPath} data={data} jiraProjects={jiraProjects} jiraIssues={jiraIssues} />
        </div>
      </section>
    </main>
  );
}

function normalizePath(path) {
  const cleanPath = path.replace(/\/$/, '') || '/dashboard';
  return cleanPath.startsWith('/dashboard') ? cleanPath : '/dashboard';
}

function Sidebar({ currentPath, importedProjects, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Cloud size={24} /> <strong>Nuvlo</strong></div>
      <nav aria-label="Navegacion principal">
        <p className="nav-section-label">Navegacion</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match ? item.match(currentPath) : currentPath.startsWith(item.href);
          return (
            <a className={`nav-item ${active ? 'active' : ''}`} href={item.href} aria-current={active ? 'page' : undefined} key={item.href} onClick={(event) => onNavigate(event, item.href)}>
              <Icon size={18} /> {item.label}
            </a>
          );
        })}
      </nav>
      <section className="project-list" aria-label="Proyectos importados">
        <p className="nav-section-label">Proyectos importados</p>
        {importedProjects.map((project, index) => (
          <a className={`project-link ${index === 0 ? 'active' : ''}`} href="/dashboard" key={project} onClick={(event) => onNavigate(event, '/dashboard')}>
            <span>{project}</span>
          </a>
        ))}
      </section>
      <div className="connection-card">
        <span>Modo demo</span>
        <strong>CSV offline</strong>
        <small>Sin llamadas a Jira</small>
      </div>
    </aside>
  );
}

function resolveView(path) {
  if (path.startsWith('/dashboard/board')) return { title: 'Tablero Kanban', section: 'Tablero', description: 'Sprint actual simulado desde CSV' };
  if (path.startsWith('/dashboard/alerts')) return { title: 'Gestion de alertas', section: 'Alertas', description: 'Reglas y avisos del proyecto' };
  if (path.startsWith('/dashboard/activity')) return { title: 'Registro de actividad', section: 'Actividad', description: 'Eventos recientes del sistema' };
  if (path.startsWith('/dashboard/settings')) return { title: 'Configuracion', section: 'Configuracion', description: 'Preferencias de demo e integracion Jira' };
  return { title: 'Panel de flujo agile', section: 'Dashboard', description: 'Metricas principales del proyecto' };
}

function Topbar({ data, view }) {
  return (
    <header className="topbar">
      <div>
        <p className="breadcrumb">Nuvlo / {data.project.name} / {view.section}</p>
        <h1>{view.title}</h1>
        <p className="topbar-description">{view.description}</p>
      </div>
      <div className="topbar-actions">
        <span className="live-pill">Live tick {data.simulation.tick}/5</span>
        <button><CalendarDays size={17} /> Ultimos 6 sprints</button>
        <button><Filter size={17} /> Filtros</button>
        <button className="sync-button"><RefreshCcw size={17} /> Simular sync</button>
      </div>
    </header>
  );
}

function ViewContent({ currentPath, data, jiraProjects, jiraIssues }) {
  if (currentPath.startsWith('/dashboard/board')) return <BoardView data={data} jiraIssues={jiraIssues} />;
  if (currentPath.startsWith('/dashboard/alerts')) return <AlertsView data={data} />;
  if (currentPath.startsWith('/dashboard/activity')) return <ActivityView data={data} />;
  if (currentPath.startsWith('/dashboard/settings')) return <SettingsView data={data} jiraProjects={jiraProjects} jiraIssues={jiraIssues} />;
  return <DashboardView data={data} />;
}

function DashboardView({ data }) {
  const { summary, charts, recentIssues, warnings } = data;

  return (
    <>
      <section className="metric-grid">
        <MetricCard icon={<Timer />} label="Lead Time medio" value={summary.leadTime.average} unit="dias" detail={`P85 ${summary.leadTime.p85} dias`} />
        <MetricCard icon={<Gauge />} label="Cycle Time medio" value={summary.cycleTime.average} unit="dias" detail={`P50 ${summary.cycleTime.p50} dias`} />
        <MetricCard icon={<ListChecks />} label="WIP actual" value={summary.wip} unit="issues" detail={summary.activeSprint} />
        <MetricCard icon={<BarChart3 />} label="Velocity" value={summary.velocity} unit="pts" detail={`${summary.throughput} issues done`} />
      </section>

      <section className="dashboard-grid">
        <article className="chart-card wide-card">
          <CardHeader title="Velocity por sprint" subtitle="Committed frente a completed desde CSV" />
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={charts.sprintMetrics}>
              <defs>
                <linearGradient id="completed" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#65a30d" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#65a30d" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e6dc" />
              <XAxis dataKey="sprint" />
              <YAxis />
              <Tooltip />
              <Area dataKey="completed" stroke="#65a30d" fill="url(#completed)" strokeWidth={3} />
              <Line dataKey="committed" stroke="#164f37" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card">
          <CardHeader title="Estado actual" subtitle="Cambia cada 5 segundos" />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={charts.statusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e6dc" />
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#164f37" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="lower-grid">
        <IssueList title="Issues recientes" subtitle="Dataset local estilo Jira" issues={recentIssues} />
        <WarningsCard warnings={warnings} />
      </section>
    </>
  );
}

function BoardView({ data, jiraIssues }) {
  const issuesSource = jiraIssues?.issues?.length ? jiraIssues.issues : data.issues;
  const columns = jiraIssues?.issues?.length
    ? [...new Set(issuesSource.map((issue) => issue.status))]
    : ['To Do', 'In Progress', 'Review', 'Done'];

  return (
    <>
      {jiraIssues?.issues?.length ? (
        <p className="source-note">Mostrando issues reales de Jira para {jiraIssues.projectKey}</p>
      ) : (
        <p className="source-note">Mostrando tablero demo desde CSV offline</p>
      )}
      <section className="kanban-grid">
      {columns.map((status) => {
        const issues = issuesSource.filter((issue) => issue.status === status);
        return (
          <article className="kanban-column" key={status}>
            <div className="column-header">
              <h2>{status}</h2>
              <span>{issues.length}</span>
            </div>
            <div className="ticket-stack">
              {issues.map((issue) => <TicketCard issue={issue} key={issue.key} />)}
            </div>
          </article>
        );
      })}
      </section>
    </>
  );
}

function AlertsView({ data }) {
  const alerts = [
    { priority: 'Alta', title: 'WIP por encima del objetivo', detail: `${data.summary.wip} issues activos en ${data.summary.activeSprint}`, action: 'Revisar tablero' },
    { priority: 'Media', title: 'Lead Time elevado', detail: `${data.summary.leadTime.average} dias de media frente al objetivo demo de 10 dias`, action: 'Analizar flujo' },
    { priority: 'Baja', title: 'Demo offline activa', detail: 'Los avisos se recalculan sobre CSV local sin llamar a Jira', action: 'Ver origen' },
  ];

  return (
    <section className="view-grid two-columns">
      <article className="table-card">
        <CardHeader title="Alertas activas" subtitle="Inspirado en CU-07 del prototipo" />
        <div className="alert-list">
          {alerts.map((alert) => <AlertRow alert={alert} key={alert.title} />)}
        </div>
      </article>
      <article className="table-card rule-card">
        <CardHeader title="Regla configurada" subtitle="MVP visual editable mas adelante" />
        <Field label="Metrica" value="Cycle Time" />
        <Field label="Operador" value="Mayor que" />
        <Field label="Umbral" value="7 dias" />
        <button className="full-button">Guardar regla</button>
      </article>
    </section>
  );
}

function ActivityView({ data }) {
  const events = [
    { type: 'Sincronizacion', text: `Tick ${data.simulation.tick}/5 aplicado sobre CSV offline`, time: 'Ahora' },
    { type: 'Metrica', text: `Velocity calculada: ${data.summary.velocity} pts`, time: 'Hace unos segundos' },
    { type: 'Alerta', text: `${data.warnings.length} avisos de validacion disponibles`, time: 'Hace 1 min' },
    { type: 'Proyecto', text: `${data.project.name} cargado como proyecto importado`, time: 'Sesion actual' },
  ];

  return (
    <section className="table-card">
      <CardHeader title="Actividad reciente del sistema" subtitle="Base para auditoria y trazabilidad" />
      <div className="timeline-list">
        {events.map((event) => (
          <div className="timeline-row" key={event.text}>
            <span>{event.time}</span>
            <strong>{event.type}</strong>
            <p>{event.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ data, jiraProjects, jiraIssues }) {
  return (
    <section className="view-grid two-columns">
      <article className="table-card">
        <CardHeader title="Integracion Jira" subtitle={jiraProjects ? 'Sesion OAuth activa' : 'Demo offline sin sesion Jira'} />
        <Field label="Estado" value={jiraProjects ? 'Conectado con Jira' : 'Demo offline'} />
        <Field label="Fuente actual" value={jiraProjects?.source || data.source} />
        <Field label="Sitio" value={jiraProjects?.site?.url || 'Sin sitio Jira activo'} />
        <Field label="Proyectos Jira" value={jiraProjects?.projects?.length ?? 0} />
        <Field label="Issues leidas" value={jiraIssues?.issues?.length ?? 0} />
      </article>
      <article className="table-card">
        <CardHeader title="Proyectos detectados" subtitle="Lectura real si OAuth esta activo" />
        <div className="compact-list">
          {(jiraProjects?.projects || [{ key: 'DEMO', name: data.project.name }]).map((project) => (
            <div className="compact-row" key={project.id || project.key}>
              <strong>{project.key}</strong>
              <span>{project.name}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="table-card">
        <CardHeader title="Configuracion de analisis" subtitle="Valores iniciales del MVP" />
        <Field label="Estados WIP" value="In Progress, Review" />
        <Field label="Estado final" value="Done" />
        <Field label="Ventana demo" value="Ultimos 6 sprints" />
        <Field label="Actualizacion" value={`${data.simulation.refreshMs / 1000}s`} />
      </article>
    </section>
  );
}

function MetricCard({ icon, label, value, unit, detail }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}<small>{unit}</small></strong>
      <p>{detail}</p>
    </article>
  );
}

function CardHeader({ title, subtitle }) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <ShieldCheck size={18} />
    </div>
  );
}

function IssueList({ title, subtitle, issues }) {
  return (
    <article className="table-card">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="issue-list">
        {issues.map((issue) => (
          <div className="issue-row" key={issue.key}>
            <strong>{issue.key}</strong>
            <span>{issue.summary}</span>
            <small>{issue.status} / {issue.points} pts</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function WarningsCard({ warnings }) {
  return (
    <article className="table-card">
      <CardHeader title="Avisos" subtitle="Validaciones de demo" />
      {warnings.map((warning) => (
        <div className="warning-row" key={warning.title}>
          <AlertTriangle size={18} />
          <div>
            <strong>{warning.title}</strong>
            <p>{warning.message}</p>
          </div>
        </div>
      ))}
    </article>
  );
}

function TicketCard({ issue }) {
  return (
    <div className="ticket-card">
      <div>
        <strong>{issue.key}</strong>
        <span>{issue.points} pts</span>
      </div>
      <p>{issue.summary}</p>
      <small>{issue.type} / {issue.assignee}</small>
    </div>
  );
}

function AlertRow({ alert }) {
  return (
    <div className={`alert-row priority-${alert.priority.toLowerCase()}`}>
      <span>{alert.priority}</span>
      <div>
        <strong>{alert.title}</strong>
        <p>{alert.detail}</p>
      </div>
      <button>{alert.action}</button>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
