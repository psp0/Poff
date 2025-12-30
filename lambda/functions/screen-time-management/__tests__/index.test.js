/**
 * Screen Time Management Lambda Unit Tests
 * 
 * 스크린타임 기록, 통계, 보상 기능을 테스트합니다.
 */

const screenTimeManagement = require('../index');

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

jest.mock('../../shared/screen-time-rewards', () => ({
  processScreenTimeRewards: jest.fn(),
  parseUsageCode: jest.fn()
}));

const { getDatabase } = require('../../shared/database');
const { authenticate, authenticateAndParseBody } = require('../../shared/auth');
const { processScreenTimeRewards, parseUsageCode } = require('../../shared/screen-time-rewards');

describe('Screen Time Management Lambda', () => {
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

      const result = await screenTimeManagement.handler(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('POST /screen-time', () => {
    const createScreenTimeEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/screen-time',
      rawPath: '/screen-time',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 400 if date is missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { usageCode: 530 }
      });

      const event = createScreenTimeEvent({ usageCode: 530 });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Date is required');
    });

    it('should return 400 if date format is invalid', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { date: '2024/12/28', usageCode: 530 }
      });

      const event = createScreenTimeEvent({ date: '2024/12/28', usageCode: 530 });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid date format');
    });

    it('should return 400 if no usage data provided', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { date: '2024-12-28' }
      });

      const event = createScreenTimeEvent({ date: '2024-12-28' });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('usageCode or (usageHours, usageMinutes)');
    });

    it('should parse usageCode and save record', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { date: '2024-12-27', usageCode: 530 }
      });

      parseUsageCode.mockReturnValue({ hours: 5, minutes: 30 });

      // Mock yesterday check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Yesterday exists

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // No existing record
            .mockResolvedValueOnce({ rows: [] }) // INSERT
            .mockResolvedValueOnce({ rows: [] }) // Weekly stats update
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Get record ID
        };
        return await callback(client);
      });

      processScreenTimeRewards.mockResolvedValue({
        lastWeekAvgMinutes: 300,
        changePercentage: 10,
        comparisonResult: '전주 평균 대비 +10% 증가',
        rewards: { mysticCharmReceived: 1 }
      });

      const event = createScreenTimeEvent({ date: '2024-12-27', usageCode: 530 });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.usage.hours).toBe(5);
      expect(body.data.usage.minutes).toBe(30);
      expect(body.data.usage.totalMinutes).toBe(330);
    });

    it('should accept usageHours/usageMinutes directly', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { date: '2024-12-27', usageHours: 3, usageMinutes: 45 }
      });

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Yesterday exists

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }) // Weekly stats update
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        };
        return await callback(client);
      });

      processScreenTimeRewards.mockResolvedValue({
        rewards: {}
      });

      const event = createScreenTimeEvent({ date: '2024-12-27', usageHours: 3, usageMinutes: 45 });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      expect(parseUsageCode).not.toHaveBeenCalled();
    });

    it('should prevent future date recording', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { date: tomorrowStr, usageHours: 5, usageMinutes: 0 }
      });

      const event = createScreenTimeEvent({ date: tomorrowStr, usageHours: 5, usageMinutes: 0 });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('future dates');
    });

    it('should require yesterday record when recording today', async () => {
      const today = new Date().toISOString().split('T')[0];

      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { date: today, usageHours: 5, usageMinutes: 0 }
      });

      mockQuery.mockResolvedValueOnce({ rows: [] }); // Yesterday does NOT exist

      const event = createScreenTimeEvent({ date: today, usageHours: 5, usageMinutes: 0 });
      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('어제 스크린타임');
    });
  });

  describe('GET /screen-time', () => {
    it('should return 400 if user ID is missing', async () => {
      authenticate.mockResolvedValue({ userId: null });

      const event = {
        httpMethod: 'GET',
        path: '/screen-time',
        rawPath: '/screen-time',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await screenTimeManagement.handler(event, {});
      expect(result.statusCode).toBe(400);
    });

    it('should return paginated screen time records', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockRecords = [
        { id: 1, date: '2024-12-27', usage_hours: 5, usage_minutes: 30, total_minutes: 330 },
        { id: 2, date: '2024-12-26', usage_hours: 4, usage_minutes: 15, total_minutes: 255 }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockRecords })
        .mockResolvedValueOnce({ rows: [{ total: '10' }] });

      const event = {
        httpMethod: 'GET',
        path: '/screen-time',
        rawPath: '/screen-time',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { limit: '10', offset: '0' }
      };

      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.records).toHaveLength(2);
      expect(body.data.pagination.total).toBe(10);
    });
  });

  describe('GET /weekly-stats', () => {
    it('should return weekly statistics with comparison', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockStats = {
        daily_records: JSON.stringify([
          { date: '2024-12-22', hours: 5, minutes: 30, totalMinutes: 330 }
        ]),
        days_logged: 5,
        total_minutes: 1500,
        avg_daily_minutes: 300,
        min_daily_minutes: 200,
        max_daily_minutes: 400
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: [{ prev_avg_daily_minutes: 350 }] });

      const event = {
        httpMethod: 'GET',
        path: '/weekly-stats',
        rawPath: '/weekly-stats',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { weekOffset: '0' }
      };

      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.summary.daysLogged).toBe(5);
      expect(body.data.comparison.isImprovement).toBe(true); // 300 < 350
    });
  });

  describe('GET /monthly-stats', () => {
    it('should return monthly statistics', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockStats = {
        daily_records: null,
        weekly_averages: null,
        days_logged: 20,
        total_minutes: 6000,
        avg_daily_minutes: 300,
        min_daily_minutes: 150,
        max_daily_minutes: 500
      };

      mockQuery.mockResolvedValue({ rows: [mockStats] });

      const event = {
        httpMethod: 'GET',
        path: '/monthly-stats',
        rawPath: '/monthly-stats',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { year: '2024', month: '12' }
      };

      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.monthPeriod.year).toBe(2024);
      expect(body.data.monthPeriod.month).toBe(12);
      expect(body.data.summary.daysLogged).toBe(20);
    });
  });

  describe('POST /reward-check', () => {
    it('should check reward eligibility', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {}
      });

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ today_minutes: 250, yesterday_minutes: 300 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // No existing reward

      const event = {
        httpMethod: 'POST',
        path: '/reward-check',
        rawPath: '/reward-check',
        requestContext: { http: { method: 'POST' } },
        body: JSON.stringify({})
      };

      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.todayMinutes).toBe(250);
      expect(body.data.yesterdayMinutes).toBe(300);
      expect(body.data.reduction).toBe(50);
      expect(body.data.eligible).toBe(true);
    });
  });

  describe('DELETE /screen-time/{date}', () => {
    it('should delete screen time record', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, usage_hours: 5, usage_minutes: 30 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Weekly stats update

      const event = {
        httpMethod: 'DELETE',
        path: '/screen-time/2024-12-27',
        rawPath: '/screen-time/2024-12-27',
        requestContext: { http: { method: 'DELETE' } },
        pathParameters: { date: '2024-12-27' },
        queryStringParameters: {}
      };

      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.message).toContain('deleted');
    });

    it('should return 404 if record not found', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const event = {
        httpMethod: 'DELETE',
        path: '/screen-time/2024-12-27',
        rawPath: '/screen-time/2024-12-27',
        requestContext: { http: { method: 'DELETE' } },
        pathParameters: { date: '2024-12-27' },
        queryStringParameters: {}
      };

      const result = await screenTimeManagement.handler(event, {});

      expect(result.statusCode).toBe(404);
    });
  });
});
