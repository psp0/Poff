/**
 * Sleep Management Lambda Unit Tests
 * 
 * 수면 기록, 보상 계산, 상태 조회 기능을 테스트합니다.
 */

const sleepManagement = require('../index');

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

describe('Sleep Management Lambda', () => {
  let mockDb;
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    mockDb = {
      query: mockQuery
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

      const result = await sleepManagement.handler(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('POST /sleep', () => {
    const createSleepEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/api/sleep',
      rawPath: '/api/sleep',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 401 if user not authenticated', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: null,
        requestBody: { start: Date.now() - 28800000, end: Date.now(), duration: 28800000 }
      });

      const event = createSleepEvent({ start: Date.now() - 28800000, end: Date.now(), duration: 28800000 });
      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(401);
    });

    it('should return 400 if required fields are missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { start: Date.now() }
      });

      const event = createSleepEvent({ start: Date.now() });
      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 400 if sleep duration is less than 4 hours', async () => {
      const now = Date.now();
      const threeHours = 3 * 60 * 60 * 1000;

      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { start: now - threeHours, end: now, duration: threeHours }
      });

      const event = createSleepEvent({ start: now - threeHours, end: now, duration: threeHours });
      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('at least 4 hours');
    });

    it('should return 400 if already recorded today', async () => {
      const now = Date.now();
      const eightHours = 8 * 60 * 60 * 1000;

      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { start: now - eightHours, end: now, duration: eightHours }
      });

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Already exists

      const event = createSleepEvent({ start: now - eightHours, end: now, duration: eightHours });
      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('이미 오늘은 수면을 기록');
    });

    it('should successfully save sleep log', async () => {
      const now = Date.now();
      const eightHours = 8 * 60 * 60 * 1000;

      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { start: now - eightHours, end: now, duration: eightHours }
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // No existing record
        .mockResolvedValueOnce({ rows: [] }) // Not weekend/holiday
        .mockResolvedValueOnce({ insertId: 1 }) // INSERT sleep log
        .mockResolvedValueOnce({ rows: [] }) // Today's pokemon
        .mockResolvedValueOnce({ rows: [] }); // Update rewarded

      const event = createSleepEvent({ start: now - eightHours, end: now, duration: eightHours });
      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.message).toContain('수면 기록');
      expect(body.data.rewardPercentage).toBeDefined();
    });
  });

  describe('GET /sleep/status', () => {
    it('should return 400 if user ID is missing', async () => {
      authenticate.mockResolvedValue({ userId: null });

      const event = {
        httpMethod: 'GET',
        path: '/api/sleep/status',
        rawPath: '/api/sleep/status',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await sleepManagement.handler(event, {});
      expect(result.statusCode).toBe(400);
    });

    it('should return sleep status with today pokemon', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockPokemon = [
        { stable_id: 'PIKACHU', name: '피카츄', base_stat_total: 320, icon_shiny_url: 'https://assets.example.com/base/img/Icons/pikachu.png' }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockPokemon }) // Today's pokemon
        .mockResolvedValueOnce({ rows: [] }) // No sleep log today
        .mockResolvedValueOnce({ rows: [] }); // Weekend/holiday check

      process.env.ASSETS_BASE_URL = 'https://assets.example.com';

      const event = {
        httpMethod: 'GET',
        path: '/api/sleep/status',
        rawPath: '/api/sleep/status',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.todayPokemon).toHaveLength(1);
      expect(body.data.todayPokemon[0].stable_id).toBe('PIKACHU');
      expect(body.data.sleepStatus.canSleepToday).toBe(true);
    });

    it('should indicate already slept if record exists', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // No pokemon today
        .mockResolvedValueOnce({
          rows: [{
            reward_percentage: 80,
            rewarded: true,
            start_time: Date.now() - 28800000
          }]
        }) // Sleep log exists
        .mockResolvedValueOnce({ rows: [] }); // Weekend check

      const event = {
        httpMethod: 'GET',
        path: '/api/sleep/status',
        rawPath: '/api/sleep/status',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.sleepStatus.canSleepToday).toBe(false);
      expect(body.data.sleepStatus.currentRewardPercentage).toBe(80);
      expect(body.data.sleepStatus.alreadyRewarded).toBe(true);
    });

    it('should correctly identify if wake up day is a weekend', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      // Mock current time to a Friday afternoon (KST)
      // 2025-12-26 (Friday) 15:00 KST = 2025-12-26 06:00 UTC
      const mockNow = new Date('2025-12-26T06:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Today's pokemon
        .mockResolvedValueOnce({ rows: [] }) // No sleep log
        .mockResolvedValueOnce({ rows: [] }); // Holiday check (not a holiday)

      const event = {
        httpMethod: 'GET',
        path: '/api/sleep/status',
        rawPath: '/api/sleep/status',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await sleepManagement.handler(event, {});
      const body = JSON.parse(result.body);

      // Friday 15:00 KST -> Next wake up is Saturday 04:01 KST -> Weekend!
      expect(body.data.sleepStatus.isWakeUpDayOff).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('POST /sleep/reward', () => {
    it('should return same data as status (refresh only)', async () => {
      authenticate.mockResolvedValue({ userId: 1 });
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {}
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const event = {
        httpMethod: 'POST',
        path: '/api/sleep/reward',
        rawPath: '/api/sleep/reward',
        requestContext: { http: { method: 'POST' } },
        body: JSON.stringify({})
      };

      const result = await sleepManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
    });
  });
});
