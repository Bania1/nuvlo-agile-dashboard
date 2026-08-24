import { useState } from 'react';
import { Activity, Bell, CalendarDays, Cloud, Filter, GitBranch, LayoutDashboard, RefreshCcw, Settings } from 'lucide-react';
import { apiUrl } from '../lib/api.js';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (path) => path === '/dashboard' },
  { href: '/dashboard/board', label: 'Tablero', icon: GitBranch },
  { href: '/dashboard/alerts', label: 'Alertas', icon: Bell },
  { href: '/dashboard/activity', label: 'Actividad', icon: Activity },
  { href: '/dashboard/settings', label: 'Configuracion', icon: Settings },
];

export function Sidebar({ currentPath, importedProjects, onNavigate, isJiraConnected, alertCount = 0 }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Cloud size={24} /> <strong>Nuvlo</strong></div>
      <nav aria-label="Navegacion principal">
        <p className="nav-section-label">Navegacion</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match ? item.match(currentPath) : currentPath.startsWith(item.href);
          const showBadge = item.href === '/dashboard/alerts' && alertCount > 0;
          return (
            <a className={`nav-item ${active ? 'active' : ''}`} href={item.href} aria-current={active ? 'page' : undefined} key={item.href} onClick={(event) => onNavigate(event, item.href)}>
              <Icon size={18} />
              <span>{item.label}</span>
              {showBadge ? <strong className="nav-badge">{alertCount}</strong> : null}
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
        <span>{isJiraConnected ? 'Jira conectado' : 'Modo demo'}</span>
        <strong>{isJiraConnected ? 'OAuth activo' : 'CSV offline'}</strong>
        <small>{isJiraConnected ? 'Datos reales disponibles' : 'Sin llamadas a Jira'}</small>
        <a className="connection-link" href={`${apiUrl}/api/auth/atlassian/start`}>
          {isJiraConnected ? 'Reconectar Jira' : 'Conectar Jira'}
        </a>
      </div>
    </aside>
  );
}

export function Topbar({ data, view, canSync, syncState, filtersOpen, alertSummary, onToggleFilters, onSync, onNavigate }) {
  return (
    <header className="topbar">
      <div>
        <p className="breadcrumb">Nuvlo / {data.project.name} / {view.section}</p>
        <h1>{view.title}</h1>
        <p className="topbar-description">{view.description}</p>
      </div>
      <div className="topbar-actions">
        <span className="live-pill">{data.source === 'postgres-jira-sync' ? 'Jira sync' : `Live tick ${data.simulation.tick}/5`}</span>
        <button><CalendarDays size={17} /> Ultimos 6 sprints</button>
        <button className={filtersOpen ? 'active-filter-button' : ''} onClick={onToggleFilters}><Filter size={17} /> Filtros</button>
        <AlertBell alertSummary={alertSummary} onNavigate={onNavigate} />
        <button className="sync-button" disabled={!canSync || syncState?.status === 'RUNNING'} onClick={onSync}>
          <RefreshCcw size={17} /> {syncState?.status === 'RUNNING' ? 'Sincronizando' : canSync ? 'Sincronizar Jira' : 'Modo demo'}
        </button>
      </div>
    </header>
  );
}

function AlertBell({ alertSummary, onNavigate }) {
  const [open, setOpen] = useState(false);
  const activeAlerts = alertSummary?.activeAlerts || [];
  const count = alertSummary?.activeCount || 0;

  function goToAlerts(event) {
    setOpen(false);
    onNavigate(event, '/dashboard/alerts');
  }

  return (
    <div className="notification-wrap">
      <button className={`notification-button ${count ? 'has-alerts' : ''}`} type="button" aria-label={`Alertas activas: ${count}`} onClick={() => setOpen((value) => !value)}>
        <Bell size={17} />
        {count ? <span className="alert-badge">{count}</span> : null}
      </button>
      {open ? (
        <div className="notification-popover">
          <div className="notification-head">
            <strong>Avisos activos</strong>
            <span>{count}</span>
          </div>
          {activeAlerts.length ? activeAlerts.slice(0, 3).map((alert) => (
            <div className="notification-item" key={alert.id || alert.title}>
              <small>{alert.priority || 'Aviso'}</small>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </div>
          )) : (
            <p className="notification-empty">No hay alertas disparadas ahora mismo.</p>
          )}
          <a className="notification-link" href="/dashboard/alerts" onClick={goToAlerts}>Ver historial de alertas</a>
        </div>
      ) : null}
    </div>
  );
}
