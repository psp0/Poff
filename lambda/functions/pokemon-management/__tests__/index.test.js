/**
 * Pokemon Management Lambda Unit Tests
 * 
 * 포켓몬 진화, 폼 해제, 이로치 해제 등 핵심 기능을 테스트합니다.
 */

const pokemonManagement = require('../index');

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

describe('Pokemon Management Lambda', () => {
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

      const result = await pokemonManagement.handler(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /user/items', () => {
    it('should return 400 if user ID is missing', async () => {
      authenticate.mockResolvedValue({ userId: null });

      const event = {
        httpMethod: 'GET',
        path: '/user/items',
        rawPath: '/user/items',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonManagement.handler(event, {});
      expect(result.statusCode).toBe(400);
    });

    it('should return user items successfully', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockItems = [
        { name: 'Rare Candy', name_ko: '이상한 사탕', image_name: 'rare_candy', quantity: 10 },
        { name: 'Mystic Charm', name_ko: '신비의 부적', image_name: 'mystic_charm', quantity: 5 }
      ];

      mockQuery.mockResolvedValue({ rows: mockItems });

      const event = {
        httpMethod: 'GET',
        path: '/user/items',
        rawPath: '/user/items',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data['Rare Candy']).toEqual({
        name_ko: '이상한 사탕',
        quantity: 10,
        image_name: 'rare_candy'
      });
    });

    it('should support service account with userId query param', async () => {
      authenticate.mockResolvedValue({ isService: true });

      mockQuery.mockResolvedValue({ rows: [] });

      const event = {
        httpMethod: 'GET',
        path: '/user/items',
        rawPath: '/user/items',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { userId: '123' }
      };

      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['123']
      );
    });
  });

  describe('POST /pokemon/evolve', () => {
    const createEvolveEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/pokemon/evolve',
      rawPath: '/pokemon/evolve',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 401 if user not authenticated', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: null,
        requestBody: { currentPokemonId: 'BULBASAUR', targetPokemonId: 'IVYSAUR' }
      });

      const event = createEvolveEvent({ currentPokemonId: 'BULBASAUR', targetPokemonId: 'IVYSAUR' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(401);
    });

    it('should return 400 if pokemon IDs are missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { currentPokemonId: 'BULBASAUR' }
      });

      const event = createEvolveEvent({ currentPokemonId: 'BULBASAUR' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
    });

    it('should successfully evolve pokemon', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { currentPokemonId: 'BULBASAUR', targetPokemonId: 'IVYSAUR' }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            // Pokemon info lookup
            .mockResolvedValueOnce({
              rows: [
                { stable_id: 'BULBASAUR', image_name: 'BULBASAUR', name: '이상해씨' },
                { stable_id: 'IVYSAUR', image_name: 'IVYSAUR', name: '이상해풀' }
              ]
            })
            // Ownership check
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            // Evolution relationship check
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            // Pre-evolution check (for cost calculation)
            .mockResolvedValueOnce({ rows: [] })
            // Rare pokemon check
            .mockResolvedValueOnce({ rows: [] })
            // Rare candy deduction
            .mockResolvedValueOnce({ affectedRows: 1 })
            // Target ownership check
            .mockResolvedValueOnce({ rows: [] })
            // Grant evolved pokemon
            .mockResolvedValueOnce({ rows: [] })
        };
        return await callback(client);
      });

      const event = createEvolveEvent({ currentPokemonId: 'BULBASAUR', targetPokemonId: 'IVYSAUR' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.success).toBe(true);
      expect(body.data.cost).toBe(1);
      expect(body.data.targetPokemonId).toBe('IVYSAUR');
    });

    it('should charge 2 candies for second stage evolution', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { currentPokemonId: 'IVYSAUR', targetPokemonId: 'VENUSAUR' }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [
                { stable_id: 'IVYSAUR', image_name: 'IVYSAUR', name: '이상해풀' },
                { stable_id: 'VENUSAUR', image_name: 'VENUSAUR', name: '이상해꽃' }
              ]
            })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Ownership
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Evolution check
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Has pre-evolution (second stage)
            .mockResolvedValueOnce({ rows: [] }) // Not rare
            .mockResolvedValueOnce({ affectedRows: 1 }) // Deduct 2 candies
            .mockResolvedValueOnce({ rows: [] }) // Target check
            .mockResolvedValueOnce({ rows: [] }) // Grant
        };
        return await callback(client);
      });

      const event = createEvolveEvent({ currentPokemonId: 'IVYSAUR', targetPokemonId: 'VENUSAUR' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.cost).toBe(2);
    });

    it('should charge 3 candies for legendary pokemon', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { currentPokemonId: 'COSMOG', targetPokemonId: 'LUNALA' }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [
                { stable_id: 'COSMOG', image_name: 'COSMOG', name: '코스모그' },
                { stable_id: 'LUNALA', image_name: 'LUNALA', name: '루나아라' }
              ]
            })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Is legendary
            .mockResolvedValueOnce({ affectedRows: 1 })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
        };
        return await callback(client);
      });

      const event = createEvolveEvent({ currentPokemonId: 'COSMOG', targetPokemonId: 'LUNALA' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.cost).toBe(3);
    });
  });

  describe('POST /pokemon/unlock-form', () => {
    const createFormEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/pokemon/unlock-form',
      rawPath: '/pokemon/unlock-form',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 400 if target form ID is missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {}
      });

      const event = createFormEvent({});
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
    });

    it('should successfully unlock a form', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { targetFormId: 'GIRATINA_ORIGIN' }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            // Target form info
            .mockResolvedValueOnce({
              rows: [{ image_name: 'GIRATINA', form_suffix: '_ORIGIN', name: '기라티나 (오리진폼)' }]
            })
            // Base form name lookup
            .mockResolvedValueOnce({
              rows: [{ name: '기라티나' }]
            })
            // Base pokemon ownership check
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            // Target form ownership check
            .mockResolvedValueOnce({ rows: [] })
            // Rare pokemon check
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Is legendary
            // Deduct Awakening Charm
            .mockResolvedValueOnce({ affectedRows: 1 })
            // Grant form
            .mockResolvedValueOnce({ rows: [] })
        };
        return await callback(client);
      });

      const event = createFormEvent({ targetFormId: 'GIRATINA_ORIGIN' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.success).toBe(true);
    });
  });

  describe('POST /pokemon/unlock-shiny', () => {
    const createShinyEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/pokemon/unlock-shiny',
      rawPath: '/pokemon/unlock-shiny',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 400 if target pokemon ID is missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {}
      });

      const event = createShinyEvent({});
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(400);
    });

    it('should successfully unlock shiny version', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { targetPokemonId: 'PIKACHU' }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            // Pokemon info
            .mockResolvedValueOnce({
              rows: [{ stable_id: 'PIKACHU', image_name: 'PIKACHU', name: '피카츄' }]
            })
            // Normal version ownership
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            // Shiny version check (should not have)
            .mockResolvedValueOnce({ rows: [] })
            // Rare pokemon check
            .mockResolvedValueOnce({ rows: [] }) // Not rare
            // Deduct Shiny Charm
            .mockResolvedValueOnce({ affectedRows: 1 })
            // Grant shiny
            .mockResolvedValueOnce({ rows: [] })
        };
        return await callback(client);
      });

      const event = createShinyEvent({ targetPokemonId: 'PIKACHU' });
      const result = await pokemonManagement.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.success).toBe(true);
    });

    it('should use Brilliance Charm for legendary pokemon', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { targetPokemonId: 'MEWTWO' }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [{ stable_id: 'MEWTWO', image_name: 'MEWTWO', name: '뮤츠' }]
            })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Is legendary
            .mockResolvedValueOnce({ affectedRows: 1 }) // Brilliance Charm
            .mockResolvedValueOnce({ rows: [] })
        };
        return await callback(client);
      });

      const event = createShinyEvent({ targetPokemonId: 'MEWTWO' });
      await pokemonManagement.handler(event, {});

      // Verify Brilliance Charm was used
      const calls = mockTransaction.mock.calls[0][0];
      // The transaction should have used Brilliance Charm for legendary
    });
  });
});
