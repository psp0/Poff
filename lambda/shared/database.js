/**
 * Database Connection Module for MySQL
 * Local development uses MySQL exclusively
 */

const mysql = require('mysql2/promise');
const { logger } = require('./logger');

// AWS SDK는 필요할 때만 로드 (로컬 개발에서는 불필요)
let SecretsManagerClient, GetSecretValueCommand;

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.secretsManager = null;
    this.dbConfig = null;
  }

  async getDbConfig() {
    if (this.dbConfig) return this.dbConfig;

    // 1. Environment variables (Local dev / Override)
    if (process.env.DB_PASSWORD) {
      this.dbConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      };
      return this.dbConfig;
    }

    // 2. Secrets Manager (AWS 환경에서만 사용)
    if (process.env.DB_SECRET_ARN) {
      try {
        // 필요할 때만 AWS SDK 로드
        if (!SecretsManagerClient) {
          const awsSdk = require("@aws-sdk/client-secrets-manager");
          SecretsManagerClient = awsSdk.SecretsManagerClient;
          GetSecretValueCommand = awsSdk.GetSecretValueCommand;
        }
        if (!this.secretsManager) {
          this.secretsManager = new SecretsManagerClient();
        }
        
        const command = new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN });
        const response = await this.secretsManager.send(command);
        const secret = JSON.parse(response.SecretString);

        this.dbConfig = {
          host: secret.host || process.env.DB_HOST,
          port: secret.port || process.env.DB_PORT || 3306,
          database: secret.dbname || process.env.DB_NAME,
          user: secret.username || process.env.DB_USER,
          password: secret.password,
        };
        return this.dbConfig;
      } catch (error) {
        logger.error('Failed to fetch database secret', error);
        throw error;
      }
    }

    throw new Error('Database configuration not found (DB_PASSWORD or DB_SECRET_ARN required)');
  }

  async connect() {
    if (this.pool && this.isConnected) {
      return this.pool;
    }

    try {
      const config = await this.getDbConfig();

      this.pool = mysql.createPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.query('SELECT 1');
      connection.release();

      this.isConnected = true;
      logger.debug('Database connected', { host: config.host, database: config.database });
      return this.pool;
    } catch (error) {
      logger.error('Database connection failed', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }

  async query(text, params = []) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connect();
        const start = Date.now();

        // Convert PostgreSQL $1, $2 placeholders to MySQL ? if needed
        const mysqlQuery = text.replace(/\$\d+/g, '?');
        const [rows, fields] = await this.pool.query(mysqlQuery, params);

        const result = {
          rows: rows,
          rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows,
          fields: fields
        };

        return result;
      } catch (error) {
        lastError = error;
        logger.error('Query failed', {
          attempt,
          maxRetries,
          errorCode: error.code,
          errorMessage: error.message,
          query: text.substring(0, 80)
        });

        if (this.isConnectionError(error) && attempt < maxRetries) {
          logger.warn('Retrying query due to connection error', { attempt: attempt + 1, maxRetries });
          this.isConnected = false;
          await this.sleep(1000 * attempt);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  async transaction(callback) {
    await this.connect();
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Create a client-like object that wraps the connection
      const client = {
        query: async (text, params) => {
          const mysqlQuery = text.replace(/\$\d+/g, '?');
          const [rows] = await connection.query(mysqlQuery, params);
          return {
            rows: rows,
            rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows
          };
        }
      };

      const result = await callback(client);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  isConnectionError(error) {
    const connectionErrorCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE'
    ];

    return connectionErrorCodes.some(code =>
      error.code === code || error.message.includes(code)
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper methods
  async findOne(table, conditions = {}, columns = '*') {
    const whereClause = Object.keys(conditions).length > 0
      ? 'WHERE ' + Object.keys(conditions).map((key, index) => `${key} = ?`).join(' AND ')
      : '';

    const query = `SELECT ${columns} FROM ${table} ${whereClause} LIMIT 1`;
    const values = Object.values(conditions);

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  async findMany(table, conditions = {}, options = {}) {
    const { columns = '*', orderBy, limit, offset } = options;

    const whereClause = Object.keys(conditions).length > 0
      ? 'WHERE ' + Object.keys(conditions).map((key, index) => `${key} = ?`).join(' AND ')
      : '';

    const orderClause = orderBy ? `ORDER BY ${orderBy}` : '';
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const offsetClause = offset ? `OFFSET ${offset}` : '';

    const query = `SELECT ${columns} FROM ${table} ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`.trim();
    const values = Object.values(conditions);

    const result = await this.query(query, values);
    return result.rows;
  }

  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders})
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  async update(table, data, conditions) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');

    const query = `
      UPDATE ${table} 
      SET ${setClause} 
      WHERE ${whereClause}
    `;

    const values = [...Object.values(data), ...Object.values(conditions)];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async delete(table, conditions) {
    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');

    const query = `DELETE FROM ${table} WHERE ${whereClause}`;
    const values = Object.values(conditions);

    const result = await this.query(query, values);
    return result.rows;
  }

  async count(table, conditions = {}) {
    const whereClause = Object.keys(conditions).length > 0
      ? 'WHERE ' + Object.keys(conditions).map(key => `${key} = ?`).join(' AND ')
      : '';

    const query = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
    const values = Object.values(conditions);

    const result = await this.query(query, values);
    return parseInt(result.rows[0].count);
  }

  async exists(table, conditions) {
    const count = await this.count(table, conditions);
    return count > 0;
  }
}

// Singleton instance
const db = new DatabaseConnection();

// Export both the instance and the class for flexibility
module.exports = db;
module.exports.DatabaseConnection = DatabaseConnection;
module.exports.getDatabase = () => db;