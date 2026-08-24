import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Gauge, ListChecks, Timer } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CardHeader, HelpHint, MetricCard } from '../components/Cards.jsx';

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
  { key: 'warnings', label: 'Avisos' },
];

export function DashboardView({ data, filtersOpen }) {
  const { summary, charts, warnings } = data;
  const [analysisFilters, setAnalysisFilters] = useState({ status: 'all', type: 'all', query: '' });
  const [visibleWidgets, setVisibleWidgets] = useState(() => readWidgetPreferences());
  const issueRows = data.issues?.length ? data.issues : data.recentIssues;
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
          <CardHeader title="Velocity por periodo" subtitle={data.source === 'postgres-jira-sync' ? 'Throughput desde issues sincronizadas' : 'Committed frente a completed desde CSV'} help="Permite comparar la capacidad del equipo entre sprints o periodos. En Jira real se alimenta de los datos sincronizados." />
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
        </article> : null}

        {visibleWidgets.statusChart ? <article className="chart-card">
          <CardHeader title="Estado actual" subtitle={analysisFilters.status === 'all' ? 'Distribucion filtrable' : `Filtro: ${analysisFilters.status}`} help="Muestra cuantas issues hay en cada estado despues de aplicar los filtros rapidos." />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={visibleStatusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e6dc" />
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#164f37" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article> : null}

        {visibleWidgets.flowChart ? <article className="chart-card flow-card">
          <CardHeader title="Tiempos de flujo" subtitle="Media, P50 y P85 en dias" help="Compara media y percentiles para Lead Time y Cycle Time. Si no hay changelog suficiente, los valores pueden ser 0." />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={buildFlowTimeChart(summary)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e6dc" />
              <XAxis dataKey="metric" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="average" name="Media" fill="#164f37" radius={[8, 8, 0, 0]} />
              <Bar dataKey="p50" name="P50" fill="#65a30d" radius={[8, 8, 0, 0]} />
              <Bar dataKey="p85" name="P85" fill="#b7791f" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article> : null}
      </section>

      <section className="lower-grid">
        {visibleWidgets.issues ? <IssueList title="Issues recientes" subtitle={data.source === 'postgres-jira-sync' ? 'Datos persistidos desde Jira' : 'Dataset local estilo Jira'} issues={visibleRecentIssues} /> : null}
        {visibleWidgets.warnings ? <WarningsCard warnings={warnings} /> : null}
      </section>
    </>
  );
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

function normalizeForSearch(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isDoneStatus(status) {
  return ['done', 'listo', 'finalizada', 'finalizado'].includes(normalizeForSearch(status));
}

function isWipStatus(status) {
  return ['in progress', 'en curso', 'review', 'revision'].includes(normalizeForSearch(status));
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
      <CardHeader title="Avisos" subtitle="Validaciones de demo" help="Avisos de calidad de datos o inconsistencias detectadas durante el analisis." />
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
