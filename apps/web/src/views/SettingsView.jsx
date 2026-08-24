import { CardHeader, Field } from '../components/Cards.jsx';
import { apiUrl } from '../lib/api.js';

export function SettingsView({ data, jiraProjects, jiraIssues, syncState, onLogout }) {
  return (
    <section className="view-grid two-columns">
      <article className="table-card">
        <CardHeader title="Integracion Jira" subtitle={jiraProjects ? 'Sesion OAuth activa' : 'Demo offline sin sesion Jira'} />
        <div className="settings-actions">
          <a className="primary-button compact-button" href={`${apiUrl}/api/auth/atlassian/start`}>
            {jiraProjects ? 'Reconectar con Jira' : 'Conectar con Jira'}
          </a>
          {jiraProjects ? <button className="secondary-action" onClick={onLogout}>Cerrar sesion</button> : null}
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
      <article className="table-card">
        <CardHeader title="Configuracion de analisis" subtitle="Fase 6: preferencias persistentes del proyecto" />
        <Field label="Estados WIP" value="In Progress, Review" />
        <Field label="Estado final" value="Done" />
        <Field label="Ventana demo" value="Ultimos 6 sprints" />
        <Field label="Actualizacion" value={data.source === 'postgres-jira-sync' ? 'Bajo demanda con sincronizacion Jira' : `${data.simulation.refreshMs / 1000}s`} />
      </article>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return 'No disponible';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
