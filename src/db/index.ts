import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('DATABASE_URL is not set. Database features will be disabled or fall back to mock.');
}

const isLocal = databaseUrl?.includes('localhost') || databaseUrl?.includes('127.0.0.1');

const pool = databaseUrl ? new Pool({ 
  connectionString: databaseUrl,
  ssl: isLocal ? false : {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
}) : null;

// Handle unexpected errors on idle clients
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
  });
}

export const db = pool ? drizzle(pool, { schema }) : null;

// Helper to check if DB is connected
export const isDbConnected = async () => {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection check failed:', err);
    return false;
  }
};
