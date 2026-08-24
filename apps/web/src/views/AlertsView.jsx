import { useEffect, useState } from 'react';
import { CardHeader, Field } from '../components/Cards.jsx';
import { deleteJson, fetchJson, patchJson, postJson } from '../lib/api.js';

const metricOptions = [
  { value: 'WIP', label: 'WIP' },
  { value: 'LEAD_TIME', label: 'Lead Time' },
  { value: 'CYCLE_TIME', label: 'Cycle Time' },
  { value: 'VELOCITY', label: 'Velocity' },
  { value: 'THROUGHPUT', label: 'Throughput' },
];

const operatorOptions = [
  { value: 'GT', label: 'Mayor que' },
  { value: 'GTE', label: 'Mayor o igual' },
  { value: 'LT', label: 'Menor que' },
  { value: 'LTE', label: 'Menor o igual' },
];

function fallbackAlerts(data) {
  return [
    { id: 'demo-wip', priority: 'Alta', title: 'WIP por encima del objetivo', detail: `${data.summary.wip} issues activos en ${data.summary.activeSprint}`, action: 'Revisar tablero', active: true },
    { id: 'demo-lead', priority: 'Media', title: 'Lead Time elevado', detail: `${data.summary.leadTime.average} dias de media frente al objetivo demo de 10 dias`, action: 'Analizar flujo', active: true },
    { id: 'demo-mode', priority: 'Baja', title: 'Demo offline activa', detail: 'Los avisos se recalculan sobre CSV local sin llamar a Jira', action: 'Ver origen', active: false },
  ];
}

export function AlertsView({ data, projectKey, onAlertsChanged }) {
  const [rules, setRules] = useState(() => fallbackAlerts(data));
  const [source, setSource] = useState('fallback');
  const [form, setForm] = useState({ metricType: 'WIP', operator: 'GT', threshold: data.summary.wip || 5 });
  const [feedback, setFeedback] = useState(null);
  const [busyRuleId, setBusyRuleId] = useState(null);

  async function loadAlerts() {
    if (!projectKey) {
      setRules(fallbackAlerts(data));
      setSource('fallback');
      return;
    }
    try {
      const payload = await fetchJson(`/api/jira/projects/${projectKey}/alerts`);
      setRules(payload.rules?.length ? payload.rules : []);
      setSource('postgres');
    } catch {
      setRules(fallbackAlerts(data));
      setSource('fallback');
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [projectKey, data]);

  async function createRule(event) {
    event.preventDefault();
    if (!projectKey) {
      setFeedback('Conecta Jira y sincroniza un proyecto para guardar reglas reales.');
      return;
    }
    try {
      await postJson(`/api/jira/projects/${projectKey}/alerts`, {
        metricType: form.metricType,
        operator: form.operator,
        threshold: Number(form.threshold),
      });
      setFeedback('Regla guardada y evaluada con las metricas actuales.');
      await loadAlerts();
      await onAlertsChanged?.();
    } catch (error) {
      setFeedback(error.message || 'No se pudo guardar la regla.');
    }
  }

  async function toggleRule(rule) {
    if (!projectKey || source !== 'postgres') return;
    setBusyRuleId(rule.id);
    try {
      await patchJson(`/api/jira/projects/${projectKey}/alerts/${rule.id}`, { enabled: !rule.enabled });
      setFeedback(!rule.enabled ? 'Regla activada.' : 'Regla pausada.');
      await loadAlerts();
      await onAlertsChanged?.();
    } catch (error) {
      setFeedback(error.message || 'No se pudo actualizar la regla.');
    } finally {
      setBusyRuleId(null);
    }
  }

  async function removeRule(rule) {
    if (!projectKey || source !== 'postgres') return;
    setBusyRuleId(rule.id);
    try {
      await deleteJson(`/api/jira/projects/${projectKey}/alerts/${rule.id}`);
      setFeedback('Regla eliminada.');
      await loadAlerts();
      await onAlertsChanged?.();
    } catch (error) {
      setFeedback(error.message || 'No se pudo eliminar la regla.');
    } finally {
      setBusyRuleId(null);
    }
  }

  const activeCount = rules.filter((rule) => rule.active).length;

  return (
    <section className="view-grid two-columns">
      <article className="table-card">
        <CardHeader title="Alertas activas" subtitle={source === 'postgres' ? `${activeCount} activas de ${rules.length} reglas reales` : 'Fallback demo hasta guardar reglas'} />
        <div className="alert-list">
          {rules.length ? rules.map((alert) => <AlertRow alert={alert} isReal={source === 'postgres'} isBusy={busyRuleId === alert.id} key={alert.id || alert.title} onDelete={removeRule} onToggle={toggleRule} />) : (
            <div className="empty-state">
              <strong>No hay reglas configuradas</strong>
              <p>Crea una regla para evaluar WIP, Lead Time, Cycle Time, Velocity o Throughput.</p>
            </div>
          )}
        </div>
      </article>
      <article className="table-card rule-card">
        <CardHeader title="Nueva regla" subtitle={projectKey ? `Proyecto ${projectKey}` : 'Requiere Jira conectado'} />
        <form className="alert-form" onSubmit={createRule}>
          <label>
            Metrica
            <select value={form.metricType} onChange={(event) => setForm((current) => ({ ...current, metricType: event.target.value }))}>
              {metricOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Operador
            <select value={form.operator} onChange={(event) => setForm((current) => ({ ...current, operator: event.target.value }))}>
              {operatorOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Umbral
            <input type="number" step="0.1" value={form.threshold} onChange={(event) => setForm((current) => ({ ...current, threshold: event.target.value }))} />
          </label>
          <button className="full-button" type="submit">Guardar regla</button>
        </form>
        {feedback ? <p className="form-feedback">{feedback}</p> : null}
        <Field label="Evaluacion" value={source === 'postgres' ? 'PostgreSQL + metricas actuales' : 'Demo local'} />
        <Field label="Reglas" value={rules.length} />
        <Field label="Historial" value={source === 'postgres' ? `${rules.reduce((total, rule) => total + (rule.events?.length || 0), 0)} eventos recientes` : 'No persistido en demo'} />
      </article>
    </section>
  );
}

function AlertRow({ alert, isReal, isBusy, onDelete, onToggle }) {
  return (
    <div className={`alert-row priority-${String(alert.priority || 'baja').toLowerCase()}`}>
      <span>{alert.priority || 'Baja'}</span>
      <div>
        <strong>{alert.title}</strong>
        <p>{alert.detail}</p>
        {alert.events?.length ? (
          <small className="alert-history">{alert.events.map((event) => `${event.status} ${formatAlertTime(event.triggeredAt)}`).join(' · ')}</small>
        ) : null}
      </div>
      <div className="alert-actions">
        <span className={`status-pill ${alert.active ? 'is-active' : ''}`}>{alert.active ? 'Activa' : 'Sin disparar'}</span>
        {isReal ? (
          <>
            <button type="button" disabled={isBusy} onClick={() => onToggle(alert)}>{alert.enabled ? 'Pausar' : 'Activar'}</button>
            <button className="danger-action" type="button" disabled={isBusy} onClick={() => onDelete(alert)}>Borrar</button>
          </>
        ) : null}
      </div>
    </div>
  );
}


function formatAlertTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
