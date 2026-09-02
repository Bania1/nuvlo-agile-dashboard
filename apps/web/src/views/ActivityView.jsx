import { useEffect, useState } from 'react';
import { CardHeader } from '../components/Cards.jsx';
import { normalizeForSearch } from '../lib/formatters.js';
import { fetchJson } from '../lib/api.js';

function formatRelativeTime(value) {
  if (!value) return 'Ahora';
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 15_000) return 'Ahora';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function fallbackEvents(data) {
  const sourceText = data.source === 'postgres-jira-sync'
    ? 'Dashboard calculado desde PostgreSQL tras sincronizar Jira'
    : `Tick ${data.simulation.tick}/5 aplicado sobre CSV offline`;
  return [
    { id: 'sync-fallback', type: 'SYNC', message: sourceText, createdAt: null },
    { id: 'metric-fallback', type: 'METRIC_CALC', message: `Velocity calculada: ${data.summary.velocity} ${data.summary.velocityUnit || 'pts'}`, createdAt: null },
    { id: 'warning-fallback', type: 'ALERT', message: `${data.warnings.length} avisos de validacion disponibles`, createdAt: null },
    { id: 'project-fallback', type: 'USER_ACTION', message: `${data.project.name} cargado como proyecto importado`, createdAt: null },
  ];
}

const typeLabels = {
  AUTH: 'Autenticacion',
  SYNC: 'Sincronizacion',
  METRIC_CALC: 'Metricas',
  ALERT: 'Alertas',
  JIRA_ERROR: 'Error Jira',
  SYSTEM_ERROR: 'Sistema',
  USER_ACTION: 'Usuario',
};

export function ActivityView({ data, onAuthExpired }) {
  const [events, setEvents] = useState(() => fallbackEvents(data));
  const [source, setSource] = useState('fallback');
  const [filters, setFilters] = useState({ type: 'all', query: '' });

  useEffect(() => {
    let alive = true;
    async function loadActivity() {
      try {
        const payload = await fetchJson('/api/activity?limit=50');
        if (!alive) return;
        setEvents(payload.events?.length ? payload.events : fallbackEvents(data));
        setSource(payload.events?.length ? 'postgres' : 'fallback');
      } catch (error) {
        if (error?.status === 401) {
          await onAuthExpired?.();
          return;
        }
        if (!alive) return;
        setEvents(fallbackEvents(data));
        setSource('fallback');
      }
    }
    loadActivity();
    return () => {
      alive = false;
    };
  }, [data]);

  const types = [...new Set(events.map((event) => event.type))].filter(Boolean);
  const filteredEvents = events.filter((event) => {
    const typeMatches = filters.type === 'all' || event.type === filters.type;
    const query = normalizeForSearch(filters.query);
    const queryMatches = !query || normalizeForSearch(`${event.type} ${event.message}`).includes(query);
    return typeMatches && queryMatches;
  });

  return (
    <section className="table-card">
      <CardHeader title="Registro de actividad" subtitle={source === 'postgres' ? `${filteredEvents.length} de ${events.length} eventos reales desde PostgreSQL` : 'Fallback local hasta conectar Jira'} help="Este registro sirve para depurar y demostrar trazabilidad: login, sincronizaciones, reglas de alerta y errores controlados." />
      <div className="log-filters">
        <label>
          Tipo
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
            <option value="all">Todos</option>
            {types.map((type) => <option value={type} key={type}>{typeLabels[type] || type}</option>)}
          </select>
        </label>
        <label>
          Buscar
          <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="sync, Jira, alerta..." />
        </label>
      </div>
      <div className="timeline-list">
        {filteredEvents.map((event) => (
          <div className="timeline-row" key={event.id || `${event.type}-${event.message}`}>
            <span>{formatRelativeTime(event.createdAt)}</span>
            <strong>{typeLabels[event.type] || event.type}</strong>
            <p>{event.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
