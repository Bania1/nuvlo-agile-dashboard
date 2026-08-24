import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const defaultAtlassianScopes = [
  'read:me',
  'read:jira-work',
  'read:jira-user',
  'offline_access',
  'read:board-scope:jira-software',
  'read:sprint:jira-software',
  'read:issue-details:jira',
  'read:jql:jira',
  'read:project:jira',
].join(' ');

for (const envPath of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../..', '.env')]) {
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(3002),
  WEB_ORIGIN: z.string().url().default('http://localhost:5174'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(24).optional(),
  ENCRYPTION_KEY: z.string().optional(),
  ATLASSIAN_CLIENT_ID: z.string().optional(),
  ATLASSIAN_CLIENT_SECRET: z.string().optional(),
  ATLASSIAN_REDIRECT_URI: z.string().url().optional(),
  ATLASSIAN_SCOPES: z.string().default(defaultAtlassianScopes),
  RETENTION_ACTIVITY_LOG_DAYS: z.coerce.number().int().positive().default(90),
  RETENTION_SYNC_RUN_DAYS: z.coerce.number().int().positive().default(180),
  RETENTION_ALERT_EVENT_DAYS: z.coerce.number().int().positive().default(180),
  RETENTION_METRIC_DAYS: z.coerce.number().int().positive().default(365),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
