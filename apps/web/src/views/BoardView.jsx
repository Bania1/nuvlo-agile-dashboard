export function BoardView({ data, jiraIssues, syncState }) {
  const issuesSource = jiraIssues?.issues?.length ? jiraIssues.issues : data.issues;
  const columns = jiraIssues?.issues?.length
    ? [...new Set(issuesSource.map((issue) => issue.status))]
    : ['To Do', 'In Progress', 'Review', 'Done'];

  return (
    <>
      {syncState?.status ? <p className="source-note">Sync: {syncState.status}{syncState.imported ? ` · ${syncState.imported.issues} issues` : ''}</p> : null}
      {jiraIssues?.issues?.length ? (
        <p className="source-note">Mostrando issues reales de {jiraIssues.source === 'postgres' ? 'PostgreSQL' : 'Jira'} para {jiraIssues.projectKey}</p>
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
