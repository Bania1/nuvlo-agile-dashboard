import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demoRowsToCsv, parseDemoCsv } from '@nuvlo/shared';

const output = resolve('data/demo/nuvlo-demo-issues.csv');
const csv = demoRowsToCsv();
await writeFile(output, csv);

const rows = parseDemoCsv(csv);
console.log(`Demo CSV generated: ${output}`);
console.log(`Issues: ${rows.length}`);
console.log('Offline source: local CSV, no Jira API calls');
