import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
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

function App() {
  const isDashboard = window.location.pathname.startsWith('/dashboard');
  return isDashboard ? <Dashboard /> : <Landing />;
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

function Dashboard() {
  const [data, setData] = useState(null);

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

  const { summary, charts, recentIssues, warnings, simulation } = data;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><Cloud size={24} /> <strong>Nuvlo</strong></div>
        <nav>
          <a className="nav-item active"><LayoutDashboard size={18} /> Dashboard</a>
          <a className="nav-item"><GitBranch size={18} /> Proyectos</a>
          <a className="nav-item"><Bell size={18} /> Alertas</a>
          <a className="nav-item"><ListChecks size={18} /> Logs</a>
        </nav>
        <div className="connection-card">
          <span>Modo demo</span>
          <strong>CSV offline</strong>
          <small>Sin llamadas a Jira</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Nuvlo / {data.project.name} / Dashboard</p>
            <h1>Panel de flujo agile</h1>
          </div>
          <div className="topbar-actions">
            <span className="live-pill">Live tick {simulation.tick}/5</span>
            <button><CalendarDays size={17} /> Ultimos 6 sprints</button>
            <button><Filter size={17} /> Filtros</button>
            <button className="sync-button"><RefreshCcw size={17} /> Simular sync</button>
          </div>
        </header>

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
          <article className="table-card">
            <CardHeader title="Issues recientes" subtitle="Dataset local estilo Jira" />
            <div className="issue-list">
              {recentIssues.map((issue) => (
                <div className="issue-row" key={issue.key}>
                  <strong>{issue.key}</strong>
                  <span>{issue.summary}</span>
                  <small>{issue.status} / {issue.points} pts</small>
                </div>
              ))}
            </div>
          </article>
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
        </section>
      </section>
    </main>
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

createRoot(document.getElementById('root')).render(<App />);
