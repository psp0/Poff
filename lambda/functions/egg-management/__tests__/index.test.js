const eggManagement = require('../index');
const { createSuccessResponse, createErrorResponse } = require('../../shared/response-utils');

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
    error: jest.fn()
  }
}));

const { getDatabase } = require('../../shared/database');
const { authenticate } = require('../../shared/auth');

describe('Egg Management Lambda', () => {
  let mockDbQuery;
  let mockDb;

  beforeEach(() => {
    mockDbQuery = jest.fn();
    mockDb = {
      query: mockDbQuery
    };
    getDatabase.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe('getUserEggs', () => {
    it('should return user eggs and round charms on success', async () => {
      // Mock Auth
      const userId = 'user123';
      authenticate.mockResolvedValue({ userId });

      // Mock DB Response
      const mockEggs = [{ egg_id: 1, pokemon_name: 'Pikachu' }];
      const mockCharms = 5;
      mockDbQuery.mockResolvedValue({
        rows: [{
          eggs: mockEggs,
          round_charms: mockCharms
        }]
      });

      // Prepare Event
      const event = {
        httpMethod: 'GET',
        path: '/eggs', // The handler logic checks endsWith('/eggs')
        requestContext: { http: { method: 'GET' } }
      };

      // Execute
      const result = await eggManagement.handler(event, {});

      // Verify
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.eggs).toEqual(mockEggs);
      expect(body.data.round_charms).toBe(mockCharms);
      
      // Verify DB Call
      expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT'), expect.arrayContaining([userId]));
    });

    it('should return 400 if user ID is missing (conceptually, though auth usually handles this)', async () => {
        // If authenticate returns an object without userId (e.g. service auth issue)
        authenticate.mockResolvedValue({ isService: true }); // No query params provided
        
        const event = {
          httpMethod: 'GET',
          path: '/eggs',
          requestContext: { http: { method: 'GET' } }
        };
  
        const result = await eggManagement.handler(event, {});
        
        expect(result.statusCode).toBe(400);
    });
  });

  describe('Routing', () => {
      it('should return 404 for unknown routes', async () => {
          const event = {
              httpMethod: 'GET',
              path: '/unknown/route',
              requestContext: { http: { method: 'GET' } }
          };
          
          const result = await eggManagement.handler(event, {});
          expect(result.statusCode).toBe(404);
      });
  });
});
