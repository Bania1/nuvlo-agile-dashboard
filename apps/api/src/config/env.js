import { z } from 'zod';

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
  ATLASSIAN_SCOPES: z.string().default('read:me read:jira-work read:jira-user offline_access'),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
