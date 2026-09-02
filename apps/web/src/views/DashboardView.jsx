import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Gauge, ListChecks, Timer } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CardHeader, HelpHint, MetricCard } from '../components/Cards.jsx';
import { formatIssueEffort, isDoneStatus, isWipStatus, normalizeForSearch } from '../lib/formatters.js';

// Preferencias locales: permiten adaptar el dashboard durante demo sin alterar datos persistidos.
const defaultWidgets = {
  leadTime: true,
  cycleTime: true,
  wip: true,
  velocity: true,
  velocityChart: true,
  statusChart: true,
  flowChart: true,
  issues: true,
  warnings: true,
};

const widgetLabels = [
  { key: 'leadTime', label: 'Lead Time' },
  { key: 'cycleTime', label: 'Cycle Time' },
  { key: 'wip', label: 'WIP' },
  { key: 'velocity', label: 'Velocity' },
  { key: 'velocityChart', label: 'Grafica velocity' },
  { key: 'statusChart', label: 'Estado actual' },
  { key: 'flowChart', label: 'Tiempos de flujo' },
  { key: 'issues', label: 'Issues recientes' },
  { key: 'warnings', label: 'Validaciones de datos' },
];

export function DashboardView({ data, filtersOpen, chartPeriod = '8' }) {
  const { summary, charts, warnings } = data;
  const [analysisFilters, setAnalysisFilters] = useState({ status: 'all', type: 'all', query: '' });
  const [visibleWidgets, setVisibleWidgets] = useState(() => readWidgetPreferences());
  const issueRows = data.issues?.length ? data.issues : data.recentIssues;
  // Los filtros son client-side: no llaman a Jira y recalculan solo la vista visible.
  const filteredIssues = issueRows.filter((issue) => {
    const statusMatches = analysisFilters.status === 'all' || issue.status === analysisFilters.status;
    const typeMatches = analysisFilters.type === 'all' || issue.type === analysisFilters.type;
    const query = normalizeForSearch(analysisFilters.query);
    const queryMatches = !query || normalizeForSearch(`${issue.key} ${issue.summary} ${issue.assignee || ''}`).includes(query);
    return statusMatches && typeMatches && queryMatches;
  });
  const visibleSummary = buildVisibleSummary(summary, filteredIssues);
  const visibleStatusBreakdown = buildStatusBreakdown(filteredIssues);
  const visibleRecentIssues = [...filteredIssues]
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 6);
  const statusOptions = [...new Set(issueRows.map((issue) => issue.status))].filter(Boolean);
  const typeOptions = [...new Set(issueRows.map((issue) => issue.type))].filter(Boolean);
  const visibleVelocitySeries = filterChartPeriods(charts.sprintMetrics || [], chartPeriod);

  useEffect(() => {
    window.localStorage.setItem('nuvlo_dashboard_widgets', JSON.stringify(visibleWidgets));
  }, [visibleWidgets]);

  function updateFilter(field, value) {
    setAnalysisFilters((current) => ({ ...current, [field]: value }));
  }

  function toggleWidget(widgetKey) {
    setVisibleWidgets((current) => ({ ...current, [widgetKey]: !current[widgetKey] }));
  }

  return (
    <>
      {filtersOpen ? <section className="analysis-panel">
        <div>
          <span>Filtros rapidos</span>
          <strong>{filteredIssues.length} de {issueRows.length} issues visibles</strong>
        </div>
        <label>
          Estado
          <select value={analysisFilters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">Todos</option>
            {statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Tipo
          <select value={analysisFilters.type} onChange={(event) => updateFilter('type', event.target.value)}>
            <option value="all">Todos</option>
            {typeOptions.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Busqueda
          <input value={analysisFilters.query} onChange={(event) => updateFilter('query', event.target.value)} placeholder="Clave, resumen o persona" />
        </label>
        <div className="widget-config">
          <div>
            <span>Widgets visibles</span>
            <HelpHint text="Permite ocultar bloques del dashboard durante una demo o analisis. Por ahora se guarda en este navegador con localStorage." />
          </div>
          <div className="widget-toggle-grid">
            {widgetLabels.map((widget) => (
              <label key={widget.key}>
                <input type="checkbox" checked={Boolean(visibleWidgets[widget.key])} onChange={() => toggleWidget(widget.key)} />
                {widget.label}
              </label>
            ))}
          </div>
        </div>
      </section> : null}

      <section className="context-help">
        <strong>Ayuda contextual</strong>
        <span>Los filtros recalculan las tarjetas visibles sin volver a llamar a Jira; las metricas reales se calculan desde PostgreSQL tras sincronizar.</span>
      </section>

      <section className="metric-grid">
        {visibleWidgets.leadTime ? <MetricCard icon={<Timer />} label="Lead Time medio" value={summary.leadTime.average} unit="dias" detail={`P50 ${summary.leadTime.p50} · P85 ${summary.leadTime.p85}`} help="Tiempo desde la creacion de una issue hasta que se considera terminada. Ayuda a detectar bloqueos de extremo a extremo." /> : null}
        {visibleWidgets.cycleTime ? <MetricCard icon={<Gauge />} label="Cycle Time medio" value={summary.cycleTime.average} unit="dias" detail={`P50 ${summary.cycleTime.p50} · P85 ${summary.cycleTime.p85}`} help="Tiempo desde que una issue entra en trabajo activo hasta que termina. Se basa en el historial de estados cuando Jira aporta changelog." /> : null}
        {visibleWidgets.wip ? <MetricCard icon={<ListChecks />} label="WIP visible" value={visibleSummary.wip} unit="issues" detail={summary.activeSprint} help="Trabajo actualmente en curso o revision dentro de los filtros seleccionados." /> : null}
        {visibleWidgets.velocity ? <MetricCard icon={<BarChart3 />} label="Velocity visible" value={visibleSummary.velocity} unit={visibleSummary.velocityUnit} detail={`${visibleSummary.throughput} issues done`} help="Trabajo completado en el periodo visible. Usa story points si Jira los aporta; si no, recurre a conteo de issues." /> : null}
      </section>

      <section className="dashboard-grid">
        {visibleWidgets.velocityChart ? <article className="chart-card wide-card">
          <CardHeader title="Velocity por periodo" subtitle={velocitySubtitle(data, visibleVelocitySeries)} help="Permite comparar la capacidad del equipo entre sprints o periodos. En Jira real se alimenta de los datos sincronizados." />
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={visibleVelocitySeries} margin={{ left: 0, right: 10, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="completed" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#65a30d" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#65a30d" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e6dc" />
              <XAxis dataKey="sprint" minTickGap={12} />
              <YAxis width={38} allowDecimals={false} />
              <Tooltip formatter={(value, name) => [value, velocityTooltipLabel(name)]} />
              <Area dataKey="completed" stroke="#65a30d" fill="url(#completed)" strokeWidth={3} />
              <Bar dataKey="done" fill="#164f37" radius={[8, 8, 0, 0]} opacity={0.18} />
              <Line dataKey="committed" stroke="#164f37" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </article> : null}

        {visibleWidgets.statusChart ? <article className="chart-card">
          <CardHeader title="Estado actual" subtitle={analysisFilters.status === 'all' ? 'Distribucion filtrable' : `Filtro: ${analysisFilters.status}`} help="Muestra cuantas issues hay en cada estado despues de aplicar los filtros rapidos." />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={visibleStatusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e6dc" />
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [value, 'Issues']} />
              <Bar dataKey="count" fill="#164f37" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article> : null}

        {visibleWidgets.flowChart ? <article className="chart-card flow-card">
          <CardHeader title="Tiempos de flujo" subtitle="Media, P50 y P85 en dias" help="Compara media y percentiles para Lead Time y Cycle Time. Si no hay changelog suficiente, los valores pueden ser 0." />
          <FlowTimeSummary rows={buildFlowTimeChart(summary)} />
        </article> : null}
      </section>

      <section className="lower-grid">
        {visibleWidgets.issues ? <IssueList title="Issues recientes" subtitle={data.source === 'postgres-jira-sync' ? 'Datos persistidos desde Jira' : 'Dataset local estilo Jira'} issues={visibleRecentIssues} /> : null}
        {visibleWidgets.warnings ? <WarningsCard warnings={warnings} source={data.source} /> : null}
      </section>
    </>
  );
}


function velocityTooltipLabel(name) {
  if (name === 'completed') return 'Completado';
  if (name === 'committed') return 'Esfuerzo total';
  if (name === 'done') return 'Issues terminadas';
  return name;
}
function filterChartPeriods(rows, period) {
  if (period === 'all') return rows;
  const count = Number(period) || 8;
  return rows.slice(-count);
}

function velocitySubtitle(data, rows) {
  const source = data.charts?.velocityGrouping || 'period';
  const visible = rows.length;
  if (source === 'sprint-label') return `Velocity por Sprint simulado desde etiquetas Jira (${visible} periodos)`;
  if (source === 'jira-sprint') return `Velocity por Sprint real de Jira (${visible} periodos)`;
  if (source === 'updated-date') return `Velocity por fecha de actualizacion (${visible} periodos)`;
  return data.source === 'postgres-jira-sync' ? `Throughput desde issues sincronizadas (${visible} periodos)` : `Committed frente a completed desde CSV (${visible} periodos)`;
}

function readWidgetPreferences() {
  try {
    const stored = JSON.parse(window.localStorage.getItem('nuvlo_dashboard_widgets') || '{}');
    return { ...defaultWidgets, ...stored };
  } catch {
    return defaultWidgets;
  }
}

function buildFlowTimeChart(summary) {
  return [
    { metric: 'Lead Time', average: summary.leadTime.average, p50: summary.leadTime.p50, p85: summary.leadTime.p85 },
    { metric: 'Cycle Time', average: summary.cycleTime.average, p50: summary.cycleTime.p50, p85: summary.cycleTime.p85 },
  ];
}

function FlowTimeSummary({ rows }) {
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.average, row.p50, row.p85].map(Number)));
  return (
    <div className="flow-summary-grid">
      {rows.map((row) => (
        <div className="flow-summary-row" key={row.metric}>
          <div>
            <strong>{row.metric}</strong>
            <span>{row.average ? `${row.average} dias de media` : 'Sin duracion calculable'}</span>
          </div>
          <FlowBar label="Media" value={row.average} maxValue={maxValue} tone="average" />
          <FlowBar label="P50" value={row.p50} maxValue={maxValue} tone="p50" />
          <FlowBar label="P85" value={row.p85} maxValue={maxValue} tone="p85" />
        </div>
      ))}
    </div>
  );
}

function FlowBar({ label, value, maxValue, tone }) {
  const numericValue = Number(value) || 0;
  const width = `${Math.max(numericValue ? 8 : 0, Math.round((numericValue / maxValue) * 100))}%`;
  return (
    <div className="flow-bar-line">
      <span>{label}</span>
      <div className="flow-bar-track" aria-hidden="true">
        <div className={`flow-bar-fill flow-bar-${tone}`} style={{ width }} />
      </div>
      <strong>{numericValue}d</strong>
    </div>
  );
}
function buildStatusBreakdown(issues) {
  const counts = new Map();
  for (const issue of issues) counts.set(issue.status, (counts.get(issue.status) || 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count }));
}

function buildVisibleSummary(summary, issues) {
  const doneIssues = issues.filter((issue) => isDoneStatus(issue.status));
  const hasStoryPoints = doneIssues.some((issue) => Number(issue.points) > 0);
  return {
    wip: issues.filter((issue) => isWipStatus(issue.status)).length,
    throughput: doneIssues.length,
    velocity: doneIssues.reduce((sum, issue) => sum + (hasStoryPoints ? Number(issue.points) || 0 : 1), 0),
    velocityUnit: hasStoryPoints ? 'pts' : summary.velocityUnit || 'issues',
  };
}

function IssueList({ title, subtitle, issues }) {
  return (
    <article className="table-card">
      <CardHeader title={title} subtitle={subtitle} help="Lista compacta para comprobar que los filtros estan afectando a los datos visibles." />
      <div className="issue-list">
        {issues.map((issue) => (
          <div className="issue-row" key={issue.key}>
            <strong>{issue.key}</strong>
            <span>{issue.summary}</span>
            <small>{issue.status} / {formatIssueEffort(issue.points)}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function WarningsCard({ warnings, source }) {
  const isJiraSource = source === 'postgres-jira-sync';
  return (
    <article className="table-card">
      <CardHeader title="Validaciones de datos" subtitle={isJiraSource ? 'Lectura de datos Jira' : 'Lectura de demo offline'} help="Comprobaciones automáticas sobre la calidad, origen y limitaciones de los datos usados en el análisis. Las alertas por umbral se gestionan en la vista Alertas." />
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
