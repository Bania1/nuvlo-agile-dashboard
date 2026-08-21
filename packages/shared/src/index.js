export const metricTypes = [
  'VELOCITY',
  'WIP',
  'LEAD_TIME',
  'CYCLE_TIME',
  'THROUGHPUT',
];

export const alertOperators = ['GT', 'GTE', 'LT', 'LTE'];

export const jiraScopes = [
  'read:me',
  'read:jira-work',
  'read:jira-user',
  'offline_access',
];

export { createDemoDataset, demoRowsToCsv, parseDemoCsv, rowsToDemoDataset, simulateDemoDataset } from './demoData.js';
