/**
 * Guest Mode Lambda Unit Tests
 * 
 * 게스트 모드 읽기 전용 API 기능을 테스트합니다.
 */

// Mock database before requiring the module
jest.mock('../../shared/database', () => ({
  query: jest.fn()
}));

jest.mock('../../shared/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const guestMode = require('../index');
const db = require('../../shared/database');

describe('Guest Mode Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASSETS_BASE_URL = 'https://assets.example.com/';
  });

  afterEach(() => {
    delete process.env.ASSETS_BASE_URL;
  });

  describe('Routing', () => {
    it('should return 404 for unknown routes', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/guest/unknown',
        rawPath: '/api/guest/unknown',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /api/guest/icons', () => {
    it('should return guest user pokemon icons', async () => {
      const mockIcons = [
        {
          base_image_name: 'PIKACHU',
          display_stable_id: 'PIKACHU',
          is_shiny: 0,
          generation: 1,
          has_icon: 1,
          has_icon_shiny: 1,
          asset_source: 'base'
        }
      ];

      db.query.mockResolvedValue({ rows: mockIcons });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/icons',
        rawPath: '/api/guest/icons',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].icon_url).toContain('Icons');
    });

    it('should use correct icon folder for shiny pokemon', async () => {
      const mockIcons = [
        {
          base_image_name: 'PIKACHU',
          display_stable_id: 'PIKACHU',
          is_shiny: 1,
          has_icon_shiny: 1,
          asset_source: 'base'
        }
      ];

      db.query.mockResolvedValue({ rows: mockIcons });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/icons',
        rawPath: '/api/guest/icons',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});
      const body = JSON.parse(result.body);

      expect(body.data[0].icon_url).toContain('Icons%20shiny');
    });
  });

  describe('GET /api/guest/all-pokemon', () => {
    it('should return all guest pokemon (same as icons)', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/all-pokemon',
        rawPath: '/api/guest/all-pokemon',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('GET /api/guest/pokemon/:stableId', () => {
    it('should return pokemon detail for guest user', async () => {
      const mockCollection = [{
        stable_id: 'PIKACHU',
        name: '피카츄',
        type1: 'Electric',
        type1_en: 'electric',
        habitat_en: 'forest',
        image_name: 'PIKACHU',
        asset_source: 'base',
        is_favorite: false,
        has_front: 1,
        has_back: 1,
        has_front_shiny: 1,
        has_back_shiny: 1
      }];

      db.query.mockResolvedValue({ rows: mockCollection });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/pokemon/PIKACHU',
        rawPath: '/api/guest/pokemon/PIKACHU',
        requestContext: { http: { method: 'GET' } },
        pathParameters: { stableId: 'PIKACHU' },
        queryStringParameters: {}
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.pokemon.name).toBe('피카츄');
      expect(body.data.front_image).toBeDefined();
      expect(body.data.background_image).toBeDefined();
    });

    it('should return 404 if pokemon not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Collection check
        .mockResolvedValueOnce({ rows: [] }); // Pokemon check

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/pokemon/UNKNOWN',
        rawPath: '/api/guest/pokemon/UNKNOWN',
        requestContext: { http: { method: 'GET' } },
        pathParameters: { stableId: 'UNKNOWN' },
        queryStringParameters: {}
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(404);
    });

    it('should handle shiny parameter', async () => {
      const mockPokemon = [{
        stable_id: 'PIKACHU',
        name: '피카츄',
        image_name: 'PIKACHU',
        asset_source: 'base',
        has_icon_shiny: 1,
        has_front_shiny: 1
      }];

      db.query.mockResolvedValue({ rows: mockPokemon });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/pokemon/PIKACHU',
        rawPath: '/api/guest/pokemon/PIKACHU',
        requestContext: { http: { method: 'GET' } },
        pathParameters: { stableId: 'PIKACHU' },
        queryStringParameters: { isShiny: 'true' }
      };

      const result = await guestMode.handler(event, {});
      const body = JSON.parse(result.body);

      expect(body.data.is_shiny).toBe(true);
      expect(body.data.front_image).toContain('shiny');
    });
  });

  describe('GET /api/guest/evolution/:baseImageName', () => {
    it('should return evolution tree for guest', async () => {
      // Root query
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No pre-evolution
        .mockResolvedValueOnce({ rows: [
          { stable_id: 'BULBASAUR', image_name: 'BULBASAUR', name: '이상해씨', level: 0, is_owned: 1 },
          { stable_id: 'IVYSAUR', image_name: 'IVYSAUR', name: '이상해풀', level: 1, is_owned: 0 }
        ]});

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/evolution/BULBASAUR',
        rawPath: '/api/guest/evolution/BULBASAUR',
        requestContext: { http: { method: 'GET' } },
        pathParameters: { baseImageName: 'BULBASAUR' },
        queryStringParameters: {}
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.evolution_tree).toBeDefined();
      expect(body.data.completion).toBeDefined();
    });

    it('should return 404 if evolution tree not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/evolution/UNKNOWN',
        rawPath: '/api/guest/evolution/UNKNOWN',
        requestContext: { http: { method: 'GET' } },
        pathParameters: { baseImageName: 'UNKNOWN' },
        queryStringParameters: {}
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /api/guest/eggs', () => {
    it('should return empty array (guests cannot have eggs)', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/guest/eggs',
        rawPath: '/api/guest/eggs',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual([]);
    });
  });

  describe('GET /api/guest/starter-pokemon', () => {
    it('should return starter pokemon list', async () => {
      const mockStarters = [
        { stable_id: 'EEVEE', name: '이브이', type1: 'Normal', image_name: 'EEVEE', asset_source: 'base', has_front: 1 },
        { stable_id: 'PICHU', name: '피츄', type1: 'Electric', image_name: 'PICHU', asset_source: 'base', has_front: 1 }
      ];

      db.query.mockResolvedValue({ rows: mockStarters });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/starter-pokemon',
        rawPath: '/api/guest/starter-pokemon',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].front_image).toBeDefined();
    });
  });

  describe('GET /api/guest/items', () => {
    it('should return fixed guest items (no DB query)', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/guest/items',
        rawPath: '/api/guest/items',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      // Fixed items for guest
      expect(body.data).toContainEqual(expect.objectContaining({ name: 'Oval Charm' }));
      expect(body.data).toContainEqual(expect.objectContaining({ name: 'Rare Candy' }));
      expect(body.data).toContainEqual(expect.objectContaining({ name: 'Shiny Charm' }));

      // Should not call database
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('Path normalization', () => {
    it('should strip CloudFront stage prefix from path', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const event = {
        httpMethod: 'GET',
        path: '/dev/api/guest/icons',
        rawPath: '/dev/api/guest/icons',
        requestContext: {
          http: { method: 'GET' },
          stage: 'dev'
        }
      };

      const result = await guestMode.handler(event, {});

      // Should recognize the route (200, not 404)
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Asset URL Building', () => {
    it('should correctly encode spaces in folder names', async () => {
      const mockIcons = [{
        base_image_name: 'PIKACHU',
        display_stable_id: 'PIKACHU',
        is_shiny: 1,
        has_icon_shiny: 1,
        asset_source: 'base'
      }];

      db.query.mockResolvedValue({ rows: mockIcons });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/icons',
        rawPath: '/api/guest/icons',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});
      const body = JSON.parse(result.body);

      // "Icons shiny" should be encoded as "Icons%20shiny"
      expect(body.data[0].icon_url).toContain('Icons%20shiny');
    });

    it('should use external asset source when specified', async () => {
      const mockIcons = [{
        base_image_name: 'CUSTOM_POKEMON',
        display_stable_id: 'CUSTOM_POKEMON',
        is_shiny: 0,
        has_icon: 1,
        asset_source: 'external'
      }];

      db.query.mockResolvedValue({ rows: mockIcons });

      const event = {
        httpMethod: 'GET',
        path: '/api/guest/icons',
        rawPath: '/api/guest/icons',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await guestMode.handler(event, {});
      const body = JSON.parse(result.body);

      expect(body.data[0].icon_url).toContain('external');
    });
  });
});
