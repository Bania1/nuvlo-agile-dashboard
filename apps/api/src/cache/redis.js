import Redis from 'ioredis';
import { env } from '../config/env.js';

let redis;

export function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redis.on('error', () => {
      // Redis is an optimization for cache/status; the API must keep working without it.
    });
  }
  return redis;
}

async function withRedis(operation) {
  try {
    const client = getRedis();
    if (client.status === 'wait') await client.connect();
    return await operation(client);
  } catch {
    return null;
  }
}

export async function getJsonCache(key) {
  const raw = await withRedis((client) => client.get(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setJsonCache(key, value, ttlSeconds) {
  return withRedis((client) => client.set(key, JSON.stringify(value), 'EX', ttlSeconds));
}

export async function setSyncStatus(key, value, ttlSeconds = 3600) {
  return setJsonCache(`sync:${key}`, { ...value, updatedAt: new Date().toISOString() }, ttlSeconds);
}

export async function getSyncStatus(key) {
  return getJsonCache(`sync:${key}`);
}
