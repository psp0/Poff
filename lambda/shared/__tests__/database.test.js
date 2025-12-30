/**
 * Database Module Unit Tests
 * 
 * 데이터베이스 연결, 쿼리 실행, 트랜잭션 처리 등을 테스트합니다.
 */

// Mock mysql2/promise before requiring the module
jest.mock('mysql2/promise', () => {
  const mockConnection = {
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn()
  };

  const mockPool = {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    query: jest.fn(),
    end: jest.fn()
  };

  return {
    createPool: jest.fn().mockReturnValue(mockPool),
    __mockPool: mockPool,
    __mockConnection: mockConnection
  };
});

jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mysql = require('mysql2/promise');
const { DatabaseConnection } = require('../database');

describe('Database Module', () => {
  let db;
  let mockPool;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a fresh instance for each test
    db = new DatabaseConnection();
    mockPool = mysql.__mockPool;
    mockConnection = mysql.__mockConnection;

    // Set environment variables for testing
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '3306';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';

    // Reset mock implementations
    mockPool.getConnection.mockResolvedValue(mockConnection);
    mockConnection.query.mockResolvedValue([[], []]);
    mockConnection.release.mockImplementation(() => { });
    mockPool.query.mockResolvedValue([[], []]);
  });

  afterEach(() => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
  });

  describe('getDbConfig', () => {
    it('should return config from environment variables', async () => {
      const config = await db.getDbConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: '3306',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      });
    });

    it('should cache config after first call', async () => {
      const config1 = await db.getDbConfig();
      const config2 = await db.getDbConfig();

      expect(config1).toBe(config2);
    });

    it('should throw error if no configuration is found', async () => {
      delete process.env.DB_PASSWORD;
      const newDb = new DatabaseConnection();

      await expect(newDb.getDbConfig()).rejects.toThrow(
        'Database configuration not found'
      );
    });
  });

  describe('connect', () => {
    it('should create a connection pool and test connection', async () => {
      await db.connect();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          database: 'test_db',
          user: 'test_user',
          password: 'test_password'
        })
      );

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(db.isConnected).toBe(true);
    });

    it('should reuse existing pool if already connected', async () => {
      await db.connect();
      await db.connect();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
    });

    it('should set isConnected to false on connection failure', async () => {
      mockPool.getConnection.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(db.connect()).rejects.toThrow('Connection failed');
      expect(db.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should end the pool and reset state', async () => {
      await db.connect();
      await db.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(db.pool).toBeNull();
      expect(db.isConnected).toBe(false);
    });

    it('should do nothing if not connected', async () => {
      await db.disconnect();
      expect(mockPool.end).not.toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should execute a query and return formatted result', async () => {
      const mockRows = [{ id: 1, name: 'test' }];
      mockPool.query.mockResolvedValueOnce([mockRows, []]);

      const result = await db.query('SELECT * FROM users WHERE id = ?', [1]);

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(1);
    });

    it('should convert PostgreSQL placeholders to MySQL placeholders', async () => {
      mockPool.query.mockResolvedValueOnce([[], []]);

      await db.query('SELECT * FROM users WHERE id = $1 AND name = $2', [1, 'test']);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ? AND name = ?',
        [1, 'test']
      );
    });

    it('should handle INSERT/UPDATE results with affectedRows', async () => {
      const mockResult = { affectedRows: 1, insertId: 5 };
      mockPool.query.mockResolvedValueOnce([mockResult, []]);

      const result = await db.query('INSERT INTO users (name) VALUES (?)', ['test']);

      expect(result.rowCount).toBe(1);
    });

    it('should retry on connection errors', async () => {
      const connectionError = new Error('Connection reset');
      connectionError.code = 'ECONNRESET';

      mockPool.query
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce([[], []]);

      const result = await db.query('SELECT 1');

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(result.rows).toEqual([]);
    });

    it('should throw after max retries', async () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';

      mockPool.query.mockRejectedValue(connectionError);

      await expect(db.query('SELECT 1')).rejects.toThrow('Connection refused');
      expect(mockPool.query).toHaveBeenCalledTimes(3); // max retries
    });
  });

  describe('transaction', () => {
    it('should execute callback within transaction and commit', async () => {
      const mockRows = [{ id: 1 }];
      mockConnection.query.mockResolvedValue([mockRows, []]);

      const result = await db.transaction(async (client) => {
        await client.query('INSERT INTO users (name) VALUES (?)', ['test']);
        return 'success';
      });

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should rollback on error and release connection', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[], []]) // For connect() check
        .mockRejectedValueOnce(new Error('Query failed')); // For actual query

      await expect(
        db.transaction(async (client) => {
          await client.query('INSERT INTO users (name) VALUES (?)', ['test']);
        })
      ).rejects.toThrow('Query failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should convert placeholders in transaction queries', async () => {
      mockConnection.query.mockResolvedValue([[], []]);

      await db.transaction(async (client) => {
        await client.query('SELECT * FROM users WHERE id = $1', [1]);
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        [1]
      );
    });
  });

  describe('helper methods', () => {
    beforeEach(async () => {
      await db.connect();
    });

    describe('findOne', () => {
      it('should return first matching row', async () => {
        const mockRow = { id: 1, name: 'test' };
        mockPool.query.mockResolvedValueOnce([[mockRow], []]);

        const result = await db.findOne('users', { id: 1 });

        expect(result).toEqual(mockRow);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM users WHERE id = ? LIMIT 1'),
          [1]
        );
      });

      it('should return null if no match', async () => {
        mockPool.query.mockResolvedValueOnce([[], []]);

        const result = await db.findOne('users', { id: 999 });

        expect(result).toBeNull();
      });
    });

    describe('findMany', () => {
      it('should return all matching rows with options', async () => {
        const mockRows = [{ id: 1 }, { id: 2 }];
        mockPool.query.mockResolvedValueOnce([mockRows, []]);

        const result = await db.findMany('users', { active: true }, {
          orderBy: 'id DESC',
          limit: 10,
          offset: 0
        });

        expect(result).toEqual(mockRows);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY id DESC'),
          [true]
        );
      });
    });

    describe('count', () => {
      it('should return count of matching rows', async () => {
        mockPool.query.mockResolvedValueOnce([[{ count: '5' }], []]);

        const result = await db.count('users', { active: true });

        expect(result).toBe(5);
      });
    });

    describe('exists', () => {
      it('should return true if record exists', async () => {
        mockPool.query.mockResolvedValueOnce([[{ count: '1' }], []]);

        const result = await db.exists('users', { id: 1 });

        expect(result).toBe(true);
      });

      it('should return false if record does not exist', async () => {
        mockPool.query.mockResolvedValueOnce([[{ count: '0' }], []]);

        const result = await db.exists('users', { id: 999 });

        expect(result).toBe(false);
      });
    });
  });

  describe('isConnectionError', () => {
    it('should identify connection error codes', () => {
      const errors = [
        { code: 'ECONNREFUSED' },
        { code: 'ENOTFOUND' },
        { code: 'ETIMEDOUT' },
        { code: 'ECONNRESET' },
        { code: 'EPIPE' }
      ];

      errors.forEach((error) => {
        expect(db.isConnectionError(error)).toBe(true);
      });
    });

    it('should return false for non-connection errors', () => {
      const error = { code: 'ER_DUP_ENTRY', message: 'Duplicate entry' };
      expect(db.isConnectionError(error)).toBe(false);
    });

    it('should check message for error codes', () => {
      const error = { message: 'Error: ECONNREFUSED' };
      expect(db.isConnectionError(error)).toBe(true);
    });
  });
});
