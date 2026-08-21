const demoRows = [
  ['NUV-1', 'Conectar cuenta Atlassian con OAuth', 'Story', 'Done', 8, 1, 'platform', 'High', 'Angel Bauste', '2026-01-03', '2026-01-06', '2026-01-10', '2026-01-12'],
  ['NUV-2', 'Crear estructura inicial del dashboard', 'Story', 'Done', 5, 1, 'frontend', 'High', 'Maya Chen', '2026-01-04', '2026-01-07', '2026-01-11', '2026-01-13'],
  ['NUV-3', 'Modelar eventos de transicion Jira', 'Task', 'Done', 3, 1, 'data', 'Medium', 'Nuvlo Bot', '2026-01-04', '2026-01-08', '2026-01-10', '2026-01-14'],
  ['NUV-4', 'Corregir error visual en filtros', 'Bug', 'Done', 2, 1, 'frontend', 'Low', 'Maya Chen', '2026-01-05', '2026-01-09', '2026-01-11', '2026-01-13'],
  ['NUV-5', 'Sincronizar proyectos y boards', 'Story', 'Done', 5, 2, 'platform', 'High', 'Angel Bauste', '2026-01-17', '2026-01-20', '2026-01-24', '2026-01-27'],
  ['NUV-6', 'Calcular lead time por issue', 'Story', 'Done', 8, 2, 'data', 'High', 'Nuvlo Bot', '2026-01-17', '2026-01-21', '2026-01-26', '2026-01-29'],
  ['NUV-7', 'Normalizar story points', 'Task', 'Done', 3, 2, 'data', 'Medium', 'Nuvlo Bot', '2026-01-18', '2026-01-22', '2026-01-25', '2026-01-28'],
  ['NUV-8', 'Evitar duplicados en sincronizacion', 'Bug', 'Done', 3, 2, 'platform', 'Medium', 'Angel Bauste', '2026-01-19', '2026-01-23', '2026-01-26', '2026-01-29'],
  ['NUV-9', 'Disenar tarjetas de metricas', 'Story', 'Done', 8, 3, 'frontend', 'High', 'Maya Chen', '2026-01-31', '2026-02-03', '2026-02-08', '2026-02-11'],
  ['NUV-10', 'Calcular cycle time por transiciones', 'Story', 'Done', 5, 3, 'data', 'High', 'Nuvlo Bot', '2026-02-01', '2026-02-04', '2026-02-09', '2026-02-12'],
  ['NUV-11', 'Registrar sync runs', 'Task', 'Done', 3, 3, 'platform', 'Medium', 'Angel Bauste', '2026-02-02', '2026-02-05', '2026-02-08', '2026-02-12'],
  ['NUV-12', 'Filtro temporal no conserva seleccion', 'Bug', 'In Progress', 2, 3, 'frontend', 'Medium', 'Maya Chen', '2026-02-03', '2026-02-07', '', ''],
  ['NUV-13', 'Crear vista de alertas', 'Story', 'Done', 5, 4, 'frontend', 'Medium', 'Maya Chen', '2026-02-14', '2026-02-17', '2026-02-21', '2026-02-24'],
  ['NUV-14', 'Detectar WIP por estado Jira', 'Story', 'In Progress', 8, 4, 'data', 'High', 'Nuvlo Bot', '2026-02-15', '2026-02-18', '', ''],
  ['NUV-15', 'Anadir backoff para rate limits', 'Task', 'Done', 3, 4, 'platform', 'High', 'Angel Bauste', '2026-02-16', '2026-02-19', '2026-02-23', '2026-02-26'],
  ['NUV-16', 'Tooltip de metrica se solapa', 'Bug', 'To Do', 2, 4, 'frontend', 'Low', '', '2026-02-17', '', '', ''],
  ['NUV-17', 'Crear historial de logs', 'Story', 'Done', 8, 5, 'platform', 'Medium', 'Angel Bauste', '2026-02-28', '2026-03-03', '2026-03-07', '2026-03-10'],
  ['NUV-18', 'Preparar seed demo de simulacion', 'Task', 'In Progress', 5, 5, 'data', 'Medium', 'Nuvlo Bot', '2026-03-01', '2026-03-04', '', ''],
  ['NUV-19', 'Configurar reglas de alerta', 'Story', 'Review', 5, 5, 'frontend', 'High', 'Maya Chen', '2026-03-02', '2026-03-05', '2026-03-09', ''],
  ['NUV-20', 'Issue sin sprint rompe agrupacion', 'Bug', 'To Do', 3, 5, 'data', 'Medium', '', '2026-03-03', '', '', ''],
  ['NUV-21', 'Pulir responsive del dashboard', 'Story', 'Done', 8, 6, 'frontend', 'High', 'Maya Chen', '2026-03-14', '2026-03-17', '2026-03-22', '2026-03-25'],
  ['NUV-22', 'Crear matriz requisito prueba', 'Task', 'In Progress', 5, 6, 'data', 'Medium', 'Nuvlo Bot', '2026-03-15', '2026-03-18', '', ''],
  ['NUV-23', 'Preparar login final con Jira', 'Story', 'Review', 8, 6, 'platform', 'High', 'Angel Bauste', '2026-03-16', '2026-03-19', '2026-03-24', ''],
  ['NUV-24', 'Sync parcial no muestra aviso', 'Bug', 'To Do', 3, 6, 'platform', 'Medium', '', '2026-03-17', '', '', ''],
];

export const demoCsvHeaders = [
  'key',
  'summary',
  'issueType',
  'status',
  'storyPoints',
  'sprint',
  'team',
  'priority',
  'assignee',
  'createdAt',
  'inProgressAt',
  'reviewAt',
  'doneAt',
];

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function demoRowsToCsv(rows = demoRows) {
  return [
    demoCsvHeaders.join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

function parseLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parseDemoCsv(csvText) {
  const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
  const headers = parseLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function toIso(date) {
  return `${date}T09:00:00.000Z`;
}

function transition(fromStatus, toStatus, date) {
  return date ? { fromStatus, toStatus, at: toIso(date) } : null;
}

function rowToIssue(row) {
  const transitions = [
    transition('To Do', 'In Progress', row.inProgressAt),
    transition('In Progress', 'Review', row.reviewAt),
    transition('Review', 'Done', row.doneAt),
  ].filter(Boolean);
  return {
    jiraId: `demo-${row.key}`,
    key: row.key,
    summary: row.summary,
    issueType: row.issueType,
    status: row.status,
    statusCategory: row.status === 'Done' ? 'Done' : row.status === 'To Do' ? 'To Do' : 'In Progress',
    priority: row.priority,
    assignee: row.assignee || null,
    labels: ['demo-nuvlo', `team-${row.team}`, `sprint-${String(row.sprint).padStart(2, '0')}`],
    team: row.team,
    storyPoints: Number(row.storyPoints),
    sprintId: `demo-sprint-${row.sprint}`,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.doneAt || row.reviewAt || row.inProgressAt || row.createdAt),
    transitions,
  };
}

export function rowsToDemoDataset(rows) {
  const sprintNumbers = [...new Set(rows.map((row) => Number(row.sprint)))].sort((a, b) => a - b);
  const sprints = sprintNumbers.map((number) => {
    const start = new Date(Date.UTC(2026, 0, 5 + (number - 1) * 14, 9, 0, 0));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 13);
    return {
      id: `demo-sprint-${number}`,
      jiraId: 8000 + number,
      name: `Nuvlo Sprint ${String(number).padStart(2, '0')}`,
      state: number === sprintNumbers.at(-1) ? 'active' : 'closed',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      completeDate: number === sprintNumbers.at(-1) ? null : end.toISOString(),
    };
  });

  return {
    generatedAt: '2026-08-21T00:00:00.000Z',
    project: { cloudId: 'demo-cloud', jiraId: '10000', key: 'NUV', name: 'Nuvlo Demo Project' },
    board: { jiraId: 7000, name: 'Nuvlo Scrum Board', type: 'scrum' },
    sprints,
    issues: rows.map(rowToIssue),
    analysisScope: {
      name: 'Demo Nuvlo - Flujo principal',
      startStatuses: ['In Progress'],
      doneStatuses: ['Done'],
      issueTypes: ['Story', 'Task', 'Bug'],
      percentileMarks: [0.5, 0.85],
      effortField: 'Story Points',
    },
  };
}

export function createDemoDataset() {
  return rowsToDemoDataset(parseDemoCsv(demoRowsToCsv()));
}

export function simulateDemoDataset(dataset, tick = 0) {
  const next = structuredClone(dataset);
  const changes = [
    [2, 'NUV-16', 'In Progress', { fromStatus: 'To Do', toStatus: 'In Progress', at: '2026-03-20T09:00:00.000Z' }],
    [3, 'NUV-19', 'Done', { fromStatus: 'Review', toStatus: 'Done', at: '2026-03-21T09:00:00.000Z' }],
    [4, 'NUV-18', 'Review', { fromStatus: 'In Progress', toStatus: 'Review', at: '2026-03-22T09:00:00.000Z' }],
    [5, 'NUV-22', 'Review', { fromStatus: 'In Progress', toStatus: 'Review', at: '2026-03-23T09:00:00.000Z' }],
  ];

  for (const [activationTick, key, status, newTransition] of changes) {
    if (tick < activationTick) continue;
    const issue = next.issues.find((item) => item.key === key);
    if (!issue) continue;
    issue.status = status;
    issue.statusCategory = status === 'Done' ? 'Done' : 'In Progress';
    issue.updatedAt = newTransition.at;
    if (!issue.transitions.some((item) => item.toStatus === newTransition.toStatus)) {
      issue.transitions.push(newTransition);
    }
  }

  return next;
}

export { demoRows };
