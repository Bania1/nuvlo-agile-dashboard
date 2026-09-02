import { formatIssueEffort } from '../lib/formatters.js';

export function BoardView({ data, jiraIssues, hasRealProjectData = Boolean(jiraIssues?.issues?.length), syncState }) {
  const hasJiraIssues = hasRealProjectData;
  const issuesSource = hasJiraIssues ? jiraIssues.issues : data.issues;
  const columns = hasJiraIssues
    ? [...new Set(issuesSource.map((issue) => issue.status))]
    : ['To Do', 'In Progress', 'Review', 'Done'];

  return (
    <>
      {syncState?.status ? <p className="source-note">Sync: {syncState.status}{syncState.imported ? ` · ${syncState.imported.issues} issues` : ''}</p> : null}
      {hasJiraIssues ? (
        <p className="source-note">Tablero sincronizado desde Jira y consultado desde {jiraIssues.source === 'postgres' ? 'PostgreSQL' : 'Jira'} para {jiraIssues.projectKey}</p>
      ) : (
        <p className="source-note">Tablero demo desde CSV offline</p>
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

function TicketCard({ issue }) {
  return (
    <div className="ticket-card">
      <div>
        <strong>{issue.key}</strong>
        <span>{formatIssueEffort(issue.points)}</span>
      </div>
      <p>{issue.summary}</p>
      <small>{issue.type} / {issue.assignee || 'Sin asignar'}</small>
    </div>
  );
}
