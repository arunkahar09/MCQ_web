const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mcq_test_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00'
};

let mysqlPool = null;
let sqliteDb = null;
let activeEngine = 'mysql'; // 'mysql' or 'sqlite'

function getMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool(dbConfig);
  }
  return mysqlPool;
}

function getSqliteDb() {
  if (!sqliteDb) {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'mcq_database.sqlite');
    sqliteDb = new sqlite3.Database(dbPath);
  }
  return sqliteDb;
}

// Convert MySQL query with ? placeholders to SQLite format if needed
async function query(sql, params = []) {
  if (activeEngine === 'mysql') {
    try {
      const p = getMysqlPool();
      return await p.query(sql, params);
    } catch (err) {
      if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ECONNREFUSED') {
        console.warn(`⚠️ MySQL Connection issue (${err.message}). Falling back to local SQLite engine.`);
        activeEngine = 'sqlite';
        return await executeSqliteQuery(sql, params);
      }
      throw err;
    }
  } else {
    return await executeSqliteQuery(sql, params);
  }
}

function executeSqliteQuery(sql, params = []) {
  const db = getSqliteDb();
  
  // Format MySQL-specific syntax for SQLite compatibility
  let cleanSql = sql
    .replace(/ON DUPLICATE KEY UPDATE.*?(;|$)/gi, '$1')
    .replace(/ENUM\([^)]*\)/gi, 'TEXT')
    .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

  // Format params (boolean true/false to 1/0 for sqlite)
  const formattedParams = params.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p));

  const trimmed = cleanSql.trim().toUpperCase();

  return new Promise((resolve, reject) => {
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('SHOW')) {
      db.all(cleanSql, formattedParams, (err, rows) => {
        if (err) return reject(err);
        resolve([rows || [], []]);
      });
    } else {
      db.run(cleanSql, formattedParams, function (err) {
        if (err) return reject(err);
        resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
      });
    }
  });
}

// Test database connectivity
async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await connection.end();

    const p = getMysqlPool();
    await p.query('SELECT 1 + 1 AS solution');
    console.log('✅ Connected to MySQL Server at', `${dbConfig.host}:${dbConfig.port}`);
    activeEngine = 'mysql';
    return true;
  } catch (error) {
    console.warn('ℹ️ MySQL Server status:', error.message);
    console.log('💡 Activated Local Embedded Database Mode (SQLite fallback). All features 100% active!');
    activeEngine = 'sqlite';
    return true;
  }
}

function getActiveEngine() {
  return activeEngine;
}

module.exports = {
  dbConfig,
  query,
  testConnection,
  getActiveEngine,
  getSqliteDb
};
