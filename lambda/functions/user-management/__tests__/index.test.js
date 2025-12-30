/**
 * User Management Lambda Unit Tests
 * 
 * 사용자 동기화, 약관 동의, 아이템 교환 등 핵심 기능을 테스트합니다.
 */

const userManagement = require('../index');

// Mocks
jest.mock('../../shared/database', () => ({
  getDatabase: jest.fn()
}));

jest.mock('../../shared/auth', () => ({
  authenticate: jest.fn(),
  authenticateAndParseBody: jest.fn()
}));

jest.mock('../../shared/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const { getDatabase } = require('../../shared/database');
const { authenticate, authenticateAndParseBody } = require('../../shared/auth');

describe('User Management Lambda', () => {
  let mockDb;
  let mockQuery;
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    mockTransaction = jest.fn();
    mockDb = {
      query: mockQuery,
      transaction: mockTransaction
    };
    getDatabase.mockReturnValue(mockDb);
  });

  describe('Routing', () => {
    it('should return 404 for unknown routes', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/unknown/route',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await userManagement.handler(event, {});
      expect(result.statusCode).toBe(404);
    });

    it('should handle OPTIONS (CORS preflight)', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        path: '/auth/sync',
        requestContext: { http: { method: 'OPTIONS' } }
      };

      const result = await userManagement.handler(event, {});
      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    });
  });

  describe('POST /auth/sync', () => {
    const createSyncEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/auth/sync',
      rawPath: '/auth/sync',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', ...body })
    });

    it('should return 401 if Firebase token is invalid', async () => {
      authenticate.mockResolvedValue({ firebaseUid: null });

      const event = createSyncEvent();
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid Firebase ID Token');
    });

    it('should sync existing user and update last login', async () => {
      const mockUser = { id: 1, email: 'test@example.com', terms_agreed_at: new Date() };

      authenticate.mockResolvedValue({
        firebaseUid: 'firebase_123',
        decodedToken: { email: 'test@example.com' },
        user: mockUser
      });

      mockQuery.mockResolvedValue({ rows: [] });

      const event = createSyncEvent();
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.userId).toBe(1);
      expect(body.data.isNewUser).toBe(false);

      // last_login 업데이트 확인
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET last_login'),
        expect.arrayContaining([1])
      );
    });

    it('should create new user if not exists', async () => {
      authenticate.mockResolvedValue({
        firebaseUid: 'firebase_new_user',
        decodedToken: { email: 'newuser@example.com' },
        user: null
      });

      // Mock transaction
      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // Email check
            .mockResolvedValueOnce({ rows: [] }) // INSERT
            .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // SELECT new user
            .mockResolvedValueOnce({ rows: [] }) // Insert default items
            .mockResolvedValueOnce({ rows: [] }) // Insert default items
            .mockResolvedValueOnce({ rows: [] }) // Insert default pokemon
        };
        return await callback(client);
      });

      const event = createSyncEvent({ email: 'newuser@example.com' });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.isNewUser).toBe(true);
    });

    it('should link legacy account if email exists without firebase_uid', async () => {
      authenticate.mockResolvedValue({
        firebaseUid: 'firebase_link',
        decodedToken: { email: 'legacy@example.com' },
        user: null
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 50 }] }) // Legacy email found
            .mockResolvedValueOnce({ rows: [] }) // UPDATE firebase_uid
        };
        return await callback(client);
      });

      const event = createSyncEvent({ email: 'legacy@example.com' });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.userId).toBe(50);
    });
  });

  describe('POST /user/terms-agreement', () => {
    const createTermsEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/user/terms-agreement',
      rawPath: '/user/terms-agreement',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 400 if user ID is missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: null,
        requestBody: { agreed: true }
      });

      const event = createTermsEvent({ agreed: true });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('User ID is required');
    });

    it('should save terms agreement', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { agreed: true }
      });

      mockQuery.mockResolvedValue({ rows: [] });

      const event = createTermsEvent({ agreed: true });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET terms_agreed_at'),
        [1]
      );
    });

    it('should save initial screen time with terms agreement', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { agreed: true, initialScreenTimeMinutes: 120 }
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // UPDATE terms
        .mockResolvedValueOnce({ rows: [] }); // INSERT screen_time_weekly_stats

      const event = createTermsEvent({ agreed: true, initialScreenTimeMinutes: 120 });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO screen_time_weekly_stats'),
        expect.any(Array)
      );
    });

    it('should ignore invalid screen time values', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { agreed: true, initialScreenTimeMinutes: 9999 } // > 1440
      });

      mockQuery.mockResolvedValue({ rows: [] });

      const event = createTermsEvent({ agreed: true, initialScreenTimeMinutes: 9999 });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      // screen_time_weekly_stats INSERT should not be called
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /user/exchange', () => {
    const createExchangeEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/user/exchange',
      rawPath: '/user/exchange',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 400 if required fields are missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { costItemName: 'Rare Candy' } // Missing other fields
      });

      const event = createExchangeEvent({ costItemName: 'Rare Candy' });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 404 if cost item not found', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {
          costItemName: 'NonexistentItem',
          costAmount: 10,
          rewardItemName: 'Oval Charm',
          rewardAmount: 1
        }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn().mockResolvedValueOnce({ rows: [] }) // Item not found
        };
        return await callback(client);
      });

      const event = createExchangeEvent({
        costItemName: 'NonexistentItem',
        costAmount: 10,
        rewardItemName: 'Oval Charm',
        rewardAmount: 1
      });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 if insufficient balance', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {
          costItemName: 'Rare Candy',
          costAmount: 100,
          rewardItemName: 'Oval Charm',
          rewardAmount: 1
        }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ item_id: 1 }] }) // Cost item found
            .mockResolvedValueOnce({ rows: [{ item_id: 2 }] }) // Reward item found
            .mockResolvedValueOnce({ rows: [{ quantity: 10 }] }) // Only 10, need 100
        };
        return await callback(client);
      });

      const event = createExchangeEvent({
        costItemName: 'Rare Candy',
        costAmount: 100,
        rewardItemName: 'Oval Charm',
        rewardAmount: 1
      });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Not enough');
    });

    it('should successfully exchange items', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {
          costItemName: 'Rare Candy',
          costAmount: 10,
          rewardItemName: 'Oval Charm',
          rewardAmount: 1
        }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ item_id: 1 }] }) // Cost item found
            .mockResolvedValueOnce({ rows: [{ item_id: 2 }] }) // Reward item found
            .mockResolvedValueOnce({ rows: [{ quantity: 50 }] }) // Sufficient balance
            .mockResolvedValueOnce({ rows: [], affectedRows: 1 }) // Deduct cost
            .mockResolvedValueOnce({ rows: [{ quantity: 5 }] }) // Check reward item
            .mockResolvedValueOnce({ rows: [], affectedRows: 1 }) // Add reward
        };
        return await callback(client);
      });

      const event = createExchangeEvent({
        costItemName: 'Rare Candy',
        costAmount: 10,
        rewardItemName: 'Oval Charm',
        rewardAmount: 1
      });
      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain('Exchanged');
    });
  });

  describe('GET /shop/items', () => {
    it('should return all shop items', async () => {
      const mockItems = [
        { item_id: 1, name: 'Rare Candy', price: 100 },
        { item_id: 2, name: 'Oval Charm', price: 50 }
      ];

      mockQuery.mockResolvedValue({ rows: mockItems });

      const event = {
        httpMethod: 'GET',
        path: '/shop/items',
        rawPath: '/shop/items',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual(mockItems);
    });
  });

  describe('GET /api/config', () => {
    beforeEach(() => {
      process.env.FIREBASE_API_KEY = 'test-api-key';
      process.env.FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      process.env.FIREBASE_PROJECT_ID = 'test-project';
      process.env.FIREBASE_MESSAGING_SENDER_ID = '123456';
      process.env.FIREBASE_APP_ID = 'test-app-id';
    });

    afterEach(() => {
      delete process.env.FIREBASE_API_KEY;
      delete process.env.FIREBASE_AUTH_DOMAIN;
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_MESSAGING_SENDER_ID;
      delete process.env.FIREBASE_APP_ID;
    });

    it('should return Firebase configuration', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/config',
        rawPath: '/api/config',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await userManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.firebase).toEqual({
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        messagingSenderId: '123456',
        appId: 'test-app-id'
      });
    });
  });

  describe('Path normalization', () => {
    it('should strip CloudFront stage prefix from path', async () => {
      authenticate.mockResolvedValue({ firebaseUid: null });

      const event = {
        httpMethod: 'POST',
        path: '/dev/auth/sync',
        rawPath: '/dev/auth/sync',
        requestContext: {
          http: { method: 'POST' },
          stage: 'dev'
        },
        body: JSON.stringify({ email: 'test@example.com' })
      };

      const result = await userManagement.handler(event, {});

      // Should recognize the route (401 from auth, not 404)
      expect(result.statusCode).toBe(401);
    });
  });
});
