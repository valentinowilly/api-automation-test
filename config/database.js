import mysql from 'mysql2/promise';
import env from './env.js';

const createPool = (database) => {
  return mysql.createPool({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database,
    waitForConnections: true,
    connectionLimit: env.database.connectionLimit,
    queueLimit: env.database.queueLimit,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
};

const pools = {
  aigen: createPool(env.database.databases.aigen),
  isourcing: createPool(env.database.databases.isourcing),
  isearch: createPool(env.database.databases.isearch),
};

export const getPool = (dbName = 'aigen') => {
  const pool = pools[dbName];
  if (!pool) {
    throw new Error(`Invalid database name: ${dbName}. Valid options are: aigen, isourcing, isearch`);
  }
  return pool;
};

export const query = async (sql, params = [], dbName = 'aigen') => {
  const pool = getPool(dbName);
  const [rows] = await pool.execute(sql, params);
  return rows;
};

export const closeAllPools = async () => {
  await Promise.all([
    pools.aigen.end(),
    pools.isourcing.end(),
    pools.isearch.end(),
  ]);
};

export const testConnection = async (dbName = 'aigen') => {
  try {
    const pool = getPool(dbName);
    await pool.query('SELECT 1');
    return { success: true, database: dbName };
  } catch (error) {
    return { success: false, database: dbName, error: error.message };
  }
};

export const testAllConnections = async () => {
  const results = await Promise.all([
    testConnection('aigen'),
    testConnection('isourcing'),
    testConnection('isearch'),
  ]);
  return results;
};

export default {
  getPool,
  query,
  closeAllPools,
  testConnection,
  testAllConnections,
};
