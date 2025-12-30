/**
 * Pokemon Collection Lambda Unit Tests
 * 
 * 포켓몬 컬렉션, 즐겨찾기, 진화 트리 조회 기능을 테스트합니다.
 */

const pokemonCollection = require('../index');

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

describe('Pokemon Collection Lambda', () => {
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

    process.env.ASSETS_BASE_URL = 'https://assets.example.com/';
  });

  afterEach(() => {
    delete process.env.ASSETS_BASE_URL;
  });

  describe('Routing', () => {
    it('should return 404 for unknown routes', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/unknown/route',
        requestContext: { http: { method: 'GET' } }
      };

      const result = await pokemonCollection.handler(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /collection', () => {
    it('should return 400 if user ID is missing', async () => {
      authenticate.mockResolvedValue({ userId: null });

      const event = {
        httpMethod: 'GET',
        path: '/collection',
        rawPath: '/collection',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});
      expect(result.statusCode).toBe(400);
    });

    it('should return user pokemon collection', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockCollection = [
        {
          collection_id: 1,
          pokemon_stable_id: 'PIKACHU',
          is_shiny: false,
          is_favorite: true,
          pokemon_name: '피카츄',
          pokemon_type1: 'Electric'
        }
      ];

      mockQuery.mockResolvedValue({ rows: [{ collection: mockCollection }] });

      const event = {
        httpMethod: 'GET',
        path: '/collection',
        rawPath: '/collection',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual(mockCollection);
    });

    it('should filter shiny when includeShiny=false', async () => {
      authenticate.mockResolvedValue({ userId: 1 });
      mockQuery.mockResolvedValue({ rows: [{ collection: [] }] });

      const event = {
        httpMethod: 'GET',
        path: '/collection',
        rawPath: '/collection',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { includeShiny: 'false' }
      };

      await pokemonCollection.handler(event, {});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, false, false])
      );
    });

    it('should filter favorites when favoritesOnly=true', async () => {
      authenticate.mockResolvedValue({ userId: 1 });
      mockQuery.mockResolvedValue({ rows: [{ collection: [] }] });

      const event = {
        httpMethod: 'GET',
        path: '/collection',
        rawPath: '/collection',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { favoritesOnly: 'true' }
      };

      await pokemonCollection.handler(event, {});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, true, true])
      );
    });
  });

  describe('POST /favorite', () => {
    const createFavoriteEvent = (body = {}) => ({
      httpMethod: 'POST',
      path: '/favorite',
      rawPath: '/favorite',
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify(body)
    });

    it('should return 400 if pokemon stable ID is missing', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: {}
      });

      const event = createFavoriteEvent({});
      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(400);
    });

    it('should toggle favorite status', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { pokemonStableId: 'PIKACHU', isShiny: false }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ is_favorite: false }] }) // Current state
            .mockResolvedValueOnce({ rows: [] }) // UPDATE
        };
        return await callback(client);
      });

      const event = createFavoriteEvent({ pokemonStableId: 'PIKACHU', isShiny: false });
      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.is_favorite).toBe(true);
      expect(body.data.message).toContain('추가');
    });

    it('should remove from favorites when already favorited', async () => {
      authenticateAndParseBody.mockResolvedValue({
        userId: 1,
        requestBody: { pokemonStableId: 'PIKACHU', isShiny: false }
      });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ is_favorite: true }] })
            .mockResolvedValueOnce({ rows: [] })
        };
        return await callback(client);
      });

      const event = createFavoriteEvent({ pokemonStableId: 'PIKACHU', isShiny: false });
      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.is_favorite).toBe(false);
      expect(body.data.message).toContain('제거');
    });
  });

  describe('GET /favorites', () => {
    it('should return favorite pokemon list', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockFavorites = [
        { collection_id: 1, pokemon_stable_id: 'PIKACHU', is_favorite: true }
      ];

      mockQuery.mockResolvedValue({ rows: [{ favorites: mockFavorites }] });

      const event = {
        httpMethod: 'GET',
        path: '/favorites',
        rawPath: '/favorites',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual(mockFavorites);
    });
  });

  describe('GET /icons', () => {
    it('should return pokemon icons with completion status', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockIcons = [
        {
          base_image_name: 'PIKACHU',
          display_stable_id: 'PIKACHU',
          is_shiny: false,
          icon_url: 'https://assets.example.com/base/img/Icons/PIKACHU.png',
          owned_count: 1,
          total_count: 3,
          completion_percentage: 33.3
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockIcons });

      const event = {
        httpMethod: 'GET',
        path: '/icons',
        rawPath: '/icons',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].completion_percentage).toBe(33.3);
    });
  });

  describe('GET /all-pokemon', () => {
    it('should return all user pokemon sorted by generation', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockPokemon = [
        { display_stable_id: 'BULBASAUR', generation: 1, pokemon_id: 1 },
        { display_stable_id: 'CHIKORITA', generation: 2, pokemon_id: 152 }
      ];

      mockQuery.mockResolvedValue({ rows: mockPokemon });

      const event = {
        httpMethod: 'GET',
        path: '/all-pokemon',
        rawPath: '/all-pokemon',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(2);
    });
  });

  describe('GET /evolution/{baseImageName}', () => {
    it('should return evolution tree for pokemon', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockEvolutionTree = {
        evolution_tree: {
          root: 'BULBASAUR',
          levels: [
            { level: 0, forms: [{ stable_id: 'BULBASAUR', name: '이상해씨' }] },
            { level: 1, forms: [{ stable_id: 'IVYSAUR', name: '이상해풀' }] },
            { level: 2, forms: [{ stable_id: 'VENUSAUR', name: '이상해꽃' }] }
          ]
        },
        completion: {
          total_count: 3,
          owned_count: 2,
          completion_percentage: 66.7
        }
      };

      mockQuery.mockResolvedValue({ rows: [{ evolution_tree: mockEvolutionTree }] });

      const event = {
        httpMethod: 'GET',
        path: '/evolution/BULBASAUR',
        rawPath: '/evolution/BULBASAUR',
        requestContext: { http: { method: 'GET' } },
        pathParameters: { baseImageName: 'BULBASAUR' },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.evolution_tree.root).toBe('BULBASAUR');
    });

    it('should return 400 if base image name is missing', async () => {
      authenticate.mockResolvedValue({ userId: null });

      const event = {
        httpMethod: 'GET',
        path: '/evolution/',
        rawPath: '/evolution/',
        requestContext: { http: { method: 'GET' } },
        pathParameters: {},
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});
      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /starters', () => {
    it('should return starter pokemon list', async () => {
      const mockStarters = [
        { stable_id: 'BULBASAUR', name: '이상해씨', type1: 'Grass', front_image: 'https://...' },
        { stable_id: 'CHARMANDER', name: '파이리', type1: 'Fire', front_image: 'https://...' },
        { stable_id: 'SQUIRTLE', name: '꼬부기', type1: 'Water', front_image: 'https://...' }
      ];

      mockQuery.mockResolvedValue({ rows: mockStarters });

      const event = {
        httpMethod: 'GET',
        path: '/starters',
        rawPath: '/starters',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(3);
    });
  });

  describe('GET /pokemon/{stableId}', () => {
    it('should return pokemon detail with images', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockPokemon = {
        stable_id: 'PIKACHU',
        name: '피카츄',
        type1: 'Electric',
        habitat_en: 'forest',
        type1_en: 'electric',
        image_name: 'PIKACHU',
        asset_source: 'base',
        has_front: 1,
        has_back: 1,
        has_cry: 1,
        url_path: 'base/img/'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockPokemon] }) // Pokemon info
        .mockResolvedValueOnce({ rows: [{ is_favorite: true }] }) // User ownership
        .mockResolvedValueOnce({ rows: [] }); // Shiny check

      const event = {
        httpMethod: 'GET',
        path: '/pokemon/PIKACHU',
        rawPath: '/pokemon/PIKACHU',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {}
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.pokemon.name).toBe('피카츄');
      expect(body.data.front_image).toBeDefined();
      expect(body.data.background_image).toBeDefined();
    });

    it('should return shiny images when isShiny=true', async () => {
      authenticate.mockResolvedValue({ userId: 1 });

      const mockPokemon = {
        stable_id: 'PIKACHU',
        has_front_shiny: 1,
        has_back_shiny: 1,
        image_name: 'PIKACHU',
        asset_source: 'base',
        url_path: 'base/img/'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockPokemon] })
        .mockResolvedValueOnce({ rows: [{ is_favorite: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Has shiny

      const event = {
        httpMethod: 'GET',
        path: '/pokemon/PIKACHU',
        rawPath: '/pokemon/PIKACHU',
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { isShiny: 'true' }
      };

      const result = await pokemonCollection.handler(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.is_shiny).toBe(true);
      expect(body.data.front_image).toContain('shiny');
    });
  });
});
