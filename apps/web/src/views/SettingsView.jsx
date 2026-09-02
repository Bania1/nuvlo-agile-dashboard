import { useEffect, useState } from 'react';
import { CardHeader, Field, HelpHint } from '../components/Cards.jsx';
import { apiUrl, patchJson } from '../lib/api.js';

const fallbackScope = {
  startStatuses: ['In Progress', 'Review'],
  doneStatuses: ['Done'],
  issueTypes: [],
  labels: [],
  percentileMarks: [50, 85],
  dateFrom: '',
  dateTo: '',
  effortField: '',
};

export function SettingsView({ data, projectKey, jiraProjects, jiraIssues, syncState, analysisScope, onAnalysisChanged, onLogout }) {
  const [form, setForm] = useState(() => scopeToForm(analysisScope?.scope));
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(scopeToForm(analysisScope?.scope));
  }, [analysisScope]);

  async function saveAnalysisScope(event) {
    event.preventDefault();
    await persistAnalysisScope(form, 'Configuracion guardada. El dashboard se ha recalculado con el nuevo ambito.');
  }

  async function restoreDefaultScope() {
    const defaults = { ...fallbackScope };
    setForm(defaults);
    await persistAnalysisScope(defaults, 'Valores iniciales restaurados y dashboard recalculado.');
  }

  async function persistAnalysisScope(scopeForm, successMessage) {
    if (!projectKey) {
      setFeedback('Conecta Jira y sincroniza un proyecto para guardar configuracion real.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await patchJson(`/api/jira/projects/${projectKey}/analysis-scope`, {
        startStatuses: scopeForm.startStatuses,
        doneStatuses: scopeForm.doneStatuses,
        issueTypes: scopeForm.issueTypes,
        labels: scopeForm.labels,
        percentileMarks: scopeForm.percentileMarks,
        dateFrom: scopeForm.dateFrom || null,
        dateTo: scopeForm.dateTo || null,
        effortField: scopeForm.effortField || null,
      });
      await onAnalysisChanged?.();
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(error.message || 'No se pudo guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view-grid two-columns">
      <article className="table-card">
        <CardHeader title="Integracion Jira" subtitle={jiraProjects ? 'Sesion OAuth activa' : 'Demo offline sin sesion Jira'} />
        <div className="settings-actions">
          <a className="primary-button compact-button" href={`${apiUrl}/api/auth/atlassian/start`}>
            {jiraProjects ? 'Reconectar con Jira' : 'Conectar con Jira'}
          </a>
          {jiraProjects ? <button className="danger-session-button" onClick={onLogout}>Cerrar sesion</button> : null}
        </div>
        <Field label="Estado" value={jiraProjects ? 'Conectado con Jira' : 'Demo offline'} />
        <Field label="Fuente actual" value={jiraProjects?.source || data.source} />
        <Field label="Sitio" value={jiraProjects?.site?.url || 'Sin sitio Jira activo'} />
        <Field label="Proyectos Jira" value={jiraProjects?.projects?.length ?? 0} />
        <Field label="Issues leidas" value={jiraIssues?.issues?.length ?? 0} />
        <Field label="Ultima sync" value={syncState?.status || jiraIssues?.syncStatus?.status || 'Sin ejecutar'} />
        <Field label="Changelog importado" value={syncState?.imported?.changelogIssues ?? jiraIssues?.syncStatus?.imported?.changelogIssues ?? 0} />
        <Field label="Token expira" value={formatDateTime(jiraProjects?.session?.accessTokenExpiresAt)} />
        <Field label="Cache Redis" value={jiraProjects ? `${jiraProjects.session?.cacheTtlSeconds || 60}s proyectos/issues` : 'No activo'} />
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

      <article className="table-card analysis-settings-card">
        <CardHeader
          title="Configuracion de analisis"
          subtitle={projectKey ? `Persistida para ${projectKey}` : 'Disponible al conectar Jira'}
          help="Define que datos entran en el calculo y que estados representan trabajo iniciado o finalizado."
        />
        <form className="analysis-settings-form" onSubmit={saveAnalysisScope}>
          <MultiCheck
            title="Estados de inicio"
            help="Se usan para calcular Cycle Time y WIP."
            options={analysisScope?.options?.statuses || fallbackScope.startStatuses}
            selected={form.startStatuses}
            onChange={(value) => setForm((current) => ({ ...current, startStatuses: value }))}
          />
          <MultiCheck
            title="Estados finales"
            help="Se usan para Lead Time, Cycle Time y Velocity."
            options={analysisScope?.options?.statuses || fallbackScope.doneStatuses}
            selected={form.doneStatuses}
            onChange={(value) => setForm((current) => ({ ...current, doneStatuses: value }))}
          />
          <MultiCheck
            title="Tipos de issue"
            help="Si no seleccionas ninguno, entran todos."
            options={analysisScope?.options?.issueTypes || []}
            selected={form.issueTypes}
            emptyText="Sin tipos detectados todavia"
            className="issue-type-check-group"
            onChange={(value) => setForm((current) => ({ ...current, issueTypes: value }))}
          />
          <MultiCheck
            title="Etiquetas"
            help="Permite acotar el analisis a trabajo etiquetado."
            options={analysisScope?.options?.labels || []}
            selected={form.labels}
            emptyText="Sin etiquetas detectadas"
            onChange={(value) => setForm((current) => ({ ...current, labels: value }))}
          />
          <MultiCheck
            title="Percentiles"
            help="Se guardan como parametros de calculo; P50 y P85 siguen visibles como referencia principal."
            options={analysisScope?.options?.percentileMarks || [50, 75, 85, 90, 95]}
            selected={form.percentileMarks}
            formatter={(value) => `P${value}`}
            onChange={(value) => setForm((current) => ({ ...current, percentileMarks: value.map(Number) }))}
          />
          <div className="date-settings-grid">
            <label>
              Desde
              <input type="date" value={form.dateFrom || ''} onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            </label>
            <label>
              Hasta
              <input type="date" value={form.dateTo || ''} onChange={(event) => setForm((current) => ({ ...current, dateTo: event.target.value }))} />
            </label>
          </div>
          <div className="effort-field-info">
            <span>Campo de esfuerzo</span>
            <strong>{form.effortField || 'Story point estimate detectado automaticamente'}</strong>
            <p>Nuvlo usa este valor como puntos de historia para Velocity. Si una issue no tiene puntos, se muestra como "Sin puntos" y las metricas pueden caer al conteo de issues.</p>
          </div>
          <div className="analysis-settings-actions">
            <button className="secondary-action" type="button" disabled={saving || !projectKey} onClick={restoreDefaultScope}>Restaurar valores iniciales</button>
            <button className="full-button" type="submit" disabled={saving || !projectKey}>{saving ? 'Guardando...' : 'Guardar configuracion'}</button>
          </div>
        </form>
        {feedback ? <p className="form-feedback">{feedback}</p> : null}
        <Field label="Ambito actual" value={`${data.analysis?.visibleIssues ?? data.summary.issues ?? 0} / ${data.analysis?.totalIssues ?? data.summary.issues ?? 0} issues`} />
        <Field label="Percentiles" value={(form.percentileMarks || []).map((mark) => `P${mark}`).join(', ') || 'P50, P85'} />
      </article>
    </section>
  );
}

function MultiCheck({ title, help, options, selected, onChange, formatter = String, emptyText = 'Sin opciones disponibles', className = '' }) {
  const normalizedOptions = [...new Set(options)].filter((option) => option !== null && option !== undefined && option !== '');
  function toggle(option) {
    const next = selected.includes(option)
      ? selected.filter((value) => value !== option)
      : [...selected, option];
    onChange(next);
  }

  return (
    <fieldset className={`multi-check-group ${className}`.trim()}>
      <legend>{title} {help ? <HelpHint text={help} /> : null}</legend>
      {normalizedOptions.length ? normalizedOptions.map((option) => (
        <label key={option}>
          <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
          {formatter(option)}
        </label>
      )) : <p>{emptyText}</p>}
    </fieldset>
  );
}

function scopeToForm(scope) {
  return {
    ...fallbackScope,
    ...(scope || {}),
    dateFrom: scope?.dateFrom || '',
    dateTo: scope?.dateTo || '',
    effortField: scope?.effortField || '',
  };
}

function formatDateTime(value) {
  if (!value) return 'No disponible';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

