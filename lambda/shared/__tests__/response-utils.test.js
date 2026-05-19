const {
  createSuccessResponse,
  createErrorResponse,
} = require('../response-utils');

describe('Response Utils', () => {
  describe('createSuccessResponse', () => {
    it('should create a success response with default status code', () => {
      const data = { foo: 'bar' };
      const response = createSuccessResponse(data);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.timestamp).toBeDefined();
    });

    it('should create a success response with custom status code', () => {
      const data = { created: true };
      const response = createSuccessResponse(data, 201);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(data);
    });
  });

  describe('createErrorResponse', () => {
    it('should create an error response with default status code', () => {
      const message = 'Something went wrong';
      const response = createErrorResponse(message);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe(message);
      expect(body.details).toBeNull();
    });

    it('should create an error response with details and custom status code', () => {
      const message = 'Invalid input';
      const details = { field: 'email', reason: 'invalid format' };
      const response = createErrorResponse(message, 400, details);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(message);
      expect(body.details).toEqual(details);
    });
  });



  describe('createPaginatedResponse', () => {
    it('should create a correctly structured paginated response', () => {
      const data = [1, 2, 3];
      const page = 1;
      const limit = 10;
      const total = 25;

      const response = createPaginatedResponse(data, page, limit, total);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data.items).toEqual(data);
      expect(body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false
      });
    });
  });

  describe('withErrorHandling', () => {
    // Mock logger to avoid console output during tests
    jest.mock('../logger', () => ({
      logger: {
        error: jest.fn()
      }
    }));

    it('should execute the handler and return its result', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: 'ok' });
      const wrappedHandler = withErrorHandling(mockHandler);

      const event = { httpMethod: 'GET' };
      const context = {};

      const result = await wrappedHandler(event, context);

      expect(mockHandler).toHaveBeenCalledWith(event, context);
      expect(result).toEqual({ statusCode: 200, body: 'ok' });
    });



    it('should catch errors and return formatted error response', async () => {
      const error = new Error('Database failed');
      error.code = 'ECONNREFUSED';
      const mockHandler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorHandling(mockHandler);

      const event = { httpMethod: 'GET' };
      const context = {};

      const result = await wrappedHandler(event, context);

      expect(result.statusCode).toBe(503);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Database connection failed');
    });
  });
});
