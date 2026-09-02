import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const fullOutput = resolve('data/jira-demo/nuvlo-jira-demo-8m.csv');
const pilotOutput = resolve('data/jira-demo/nuvlo-jira-demo-pilot.csv');
const remainingOutput = resolve('data/jira-demo/nuvlo-jira-demo-remaining.csv');
const checkOnly = process.argv.includes('--check');

const columns = [
  'Summary',
  'Issue Type',
  'Status',
  'Priority',
  'Labels',
  'Story point estimate',
  'Sprint',
  'Created',
  'Updated',
  'Nuvlo Started At',
  'Nuvlo Done At',
  'Description',
];

const issueTypes = ['Story', 'Story', 'Story', 'Story', 'Story', 'Task', 'Task', 'Task', 'Bug'];
const storyPoints = [1, 2, 3, 5, 8, 13];
const priorities = ['Medium', 'Medium', 'High', 'Medium', 'Low', 'High', 'Medium', 'Highest', 'Low'];
const areas = ['frontend', 'backend', 'datos', 'oauth', 'alertas', 'ux', 'testing', 'documentacion'];
const epics = [
  'Autenticacion con Atlassian',
  'Sincronizacion Jira',
  'Panel de metricas',
  'Configuracion de analisis',
  'Alertas y actividad',
  'Calidad y validacion',
  'Experiencia responsive',
  'Demo y documentacion',
];

const summaryPool = {
  Story: [
    'Como usuario quiero consultar el estado del flujo del proyecto',
    'Como usuario quiero filtrar metricas por Sprint y estado',
    'Como usuario quiero visualizar alertas operativas',
    'Como usuario quiero revisar actividad reciente de sincronizacion',
    'Como usuario quiero configurar criterios de analisis por proyecto',
    'Como usuario quiero alternar entre Jira real y demo controlada',
  ],
  Task: [
    'Implementar servicio de lectura paginada de Jira',
    'Normalizar campos importados desde Jira Cloud',
    'Preparar pruebas de metricas con datos controlados',
    'Ajustar componentes visuales del dashboard',
    'Documentar decisiones tecnicas de la integracion',
    'Revisar accesibilidad de acciones principales',
  ],
  Bug: [
    'Corregir inconsistencia al mostrar WIP despues de sincronizar',
    'Evitar que una alerta duplicada incremente el contador',
    'Corregir lectura de story points en campos personalizados',
    'Revisar aviso cuando falta historial de transiciones',
    'Ajustar renderizado responsive en resoluciones pequenas',
  ],
};

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addHours(date, hours) {
  const copy = new Date(date);
  copy.setUTCHours(copy.getUTCHours() + hours);
  return copy;
}

function formatDate(date) {
  if (!date) return '';
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n') + '\n';
}

function pick(list, index) {
  return list[index % list.length];
}

function statusFor(sprintNumber, issueIndex) {
  if (sprintNumber <= 12) return 'Done';
  if (sprintNumber <= 14) return pick(['Done', 'Done', 'Done', 'Review', 'In Progress'], issueIndex);
  return pick(['Done', 'Review', 'In Progress', 'To Do', 'In Progress', 'Review', 'To Do'], issueIndex);
}

function makeIssue({ sprintNumber, issueIndex, absoluteIndex, sprintStart }) {
  const issueType = pick(issueTypes, absoluteIndex + sprintNumber);
  const status = statusFor(sprintNumber, issueIndex);
  const area = pick(areas, absoluteIndex * 3 + sprintNumber);
  const epic = pick(epics, absoluteIndex + issueIndex);
  const summaryBase = pick(summaryPool[issueType], absoluteIndex + sprintNumber);
  const points = issueType === 'Bug' ? pick([1, 2, 3, 5], absoluteIndex) : pick(storyPoints, absoluteIndex + sprintNumber);
  const createdOffset = (issueIndex * 2 + sprintNumber) % 9 - 2;
  const startDelay = 1 + ((absoluteIndex + sprintNumber) % 5);
  const cycleDays = 3 + ((absoluteIndex * 2 + sprintNumber) % 8);
  const created = addHours(addDays(sprintStart, createdOffset), 9 + (issueIndex % 5));
  const started = status === 'To Do' ? null : addHours(addDays(created, startDelay), 1);
  const done = status === 'Done' ? addHours(addDays(started, cycleDays), 2) : null;
  const updated = done || (started ? addDays(started, status === 'Review' ? 4 : 2) : addDays(created, 1));
  const blocked = issueIndex === 7 && sprintNumber % 4 === 0;
  const reopened = issueType === 'Bug' && sprintNumber % 5 === 0;
  const labels = [
    'nuvlo-demo',
    `area-${area}`,
    `sprint-${String(sprintNumber).padStart(2, '0')}`,
    issueType === 'Bug' ? 'bugfix' : 'producto',
    blocked ? 'bloqueada' : null,
    reopened ? 'reabierta' : null,
  ].filter(Boolean).join(' ');

  return {
    Summary: `${summaryBase} (${epic})`,
    'Issue Type': issueType,
    Status: status,
    Priority: pick(priorities, absoluteIndex + issueIndex),
    Labels: labels,
    'Story point estimate': points,
    Sprint: `PCC Sprint ${String(sprintNumber).padStart(2, '0')}`,
    Created: formatDate(created),
    Updated: formatDate(updated),
    'Nuvlo Started At': formatDate(started),
    'Nuvlo Done At': formatDate(done),
    Description: [
      `Dataset controlado para Nuvlo. Area: ${area}.`,
      `Caso: ${issueType}. Sprint historico de dos semanas.`,
      blocked ? 'Incluye bloqueo simulado para explicar avisos de flujo.' : '',
      reopened ? 'Incluye reapertura simulada documentada en etiquetas.' : '',
    ].filter(Boolean).join(' '),
    _createdDate: created,
    _startedDate: started,
    _doneDate: done,
    _points: points,
  };
}

function generateRows() {
  const rows = [];
  const firstSprintStart = new Date(Date.UTC(2026, 0, 5, 8, 0, 0));
  for (let sprintNumber = 1; sprintNumber <= 16; sprintNumber += 1) {
    const sprintStart = addDays(firstSprintStart, (sprintNumber - 1) * 14);
    const issuesInSprint = sprintNumber % 4 === 0 ? 10 : sprintNumber % 5 === 0 ? 8 : 9;
    for (let issueIndex = 0; issueIndex < issuesInSprint; issueIndex += 1) {
      rows.push(makeIssue({
        sprintNumber,
        issueIndex,
        absoluteIndex: rows.length,
        sprintStart,
      }));
    }
  }
  return rows;
}

function daysBetween(start, end) {
  return (end.getTime() - start.getTime()) / 86_400_000;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function validateRows(rows) {
  const errors = [];
  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    if (!row.Summary) errors.push(`Line ${line}: Summary is required.`);
    if (!['Story', 'Task', 'Bug'].includes(row['Issue Type'])) errors.push(`Line ${line}: invalid Issue Type.`);
    if (!['To Do', 'In Progress', 'Review', 'Done'].includes(row.Status)) errors.push(`Line ${line}: invalid Status.`);
    if (!Number.isFinite(Number(row['Story point estimate']))) errors.push(`Line ${line}: story points must be numeric.`);
    if (row._startedDate && row._createdDate > row._startedDate) errors.push(`Line ${line}: Created must be before Nuvlo Started At.`);
    if (row._doneDate && row._startedDate && row._startedDate > row._doneDate) errors.push(`Line ${line}: Nuvlo Started At must be before Nuvlo Done At.`);
    if (row.Status === 'Done' && !row._doneDate) errors.push(`Line ${line}: Done issues need Nuvlo Done At.`);
    if (row.Status !== 'Done' && row._doneDate) errors.push(`Line ${line}: open issues should not have Nuvlo Done At.`);
  }
  return errors;
}

function summarize(rows) {
  const doneRows = rows.filter((row) => row._doneDate);
  const leadTimes = doneRows.map((row) => daysBetween(row._createdDate, row._doneDate));
  const cycleTimes = doneRows.filter((row) => row._startedDate).map((row) => daysBetween(row._startedDate, row._doneDate));
  const velocityBySprint = new Map();
  for (const row of doneRows) {
    velocityBySprint.set(row.Sprint, (velocityBySprint.get(row.Sprint) || 0) + Number(row._points));
  }
  return {
    issues: rows.length,
    done: doneRows.length,
    open: rows.length - doneRows.length,
    sprints: new Set(rows.map((row) => row.Sprint)).size,
    averageLeadTime: Number((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length).toFixed(1)),
    p50LeadTime: Number(percentile(leadTimes, 50).toFixed(1)),
    p85LeadTime: Number(percentile(leadTimes, 85).toFixed(1)),
    averageCycleTime: Number((cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length).toFixed(1)),
    p50CycleTime: Number(percentile(cycleTimes, 50).toFixed(1)),
    p85CycleTime: Number(percentile(cycleTimes, 85).toFixed(1)),
    minVelocity: Math.min(...velocityBySprint.values()),
    maxVelocity: Math.max(...velocityBySprint.values()),
  };
}

function exportableRows(rows) {
  return rows.map(({ _createdDate, _startedDate, _doneDate, _points, ...row }) => row);
}

const rows = generateRows();
const errors = validateRows(rows);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const summary = summarize(rows);
if (!checkOnly) {
  await mkdir(dirname(fullOutput), { recursive: true });
  await writeFile(fullOutput, toCsv(exportableRows(rows)));
  await writeFile(pilotOutput, toCsv(exportableRows(rows.slice(0, 10))));
  await writeFile(remainingOutput, toCsv(exportableRows(rows.slice(10))));
}

console.log(`Jira demo dataset ${checkOnly ? 'validated' : 'generated'} successfully.`);
console.log(`Full CSV: ${fullOutput}`);
console.log(`Pilot CSV: ${pilotOutput}`);
console.log(`Remaining CSV: ${remainingOutput}`);
console.log(JSON.stringify(summary, null, 2));
