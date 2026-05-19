const { authenticate, verifyToken, requireAdmin, requireOwnership } = require('../auth');

// Mocks
jest.mock('firebase-admin', () => {
  const verifyIdToken = jest.fn();
  return {
    auth: () => ({
      verifyIdToken
    }),
    credential: {
      cert: jest.fn(),
      applicationDefault: jest.fn()
    },
    initializeApp: jest.fn(),
    apps: []
  };
});

jest.mock('../database', () => ({
  findOne: jest.fn()
}));

jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const admin = require('firebase-admin');
const db = require('../database');

describe('Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return userId and firebaseUid for valid token and existing user', async () => {
      const mockDecodedToken = { uid: 'firebase_123' };
      const mockUser = { id: 1, email: 'test@example.com' };
      
      admin.auth().verifyIdToken.mockResolvedValue(mockDecodedToken);
      db.findOne.mockResolvedValue(mockUser);

      const event = {
        headers: { Authorization: 'Bearer valid_token' }
      };

      const result = await authenticate(event);

      expect(result.userId).toBe(1);
      expect(result.firebaseUid).toBe('firebase_123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should return userId null if token is missing', async () => {
      const event = { headers: {} };
      const result = await authenticate(event);
      expect(result.userId).toBeNull();
    });

    it('should return userId null if token verification fails', async () => {
      admin.auth().verifyIdToken.mockRejectedValue(new Error('Invalid token'));
      
      const event = {
        headers: { Authorization: 'Bearer invalid_token' }
      };

      const result = await authenticate(event);
      expect(result.userId).toBeNull();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for admin user', () => {
      const user = { role: 'admin' };
      const result = requireAdmin(user);
      expect(result.user).toBe(user);
      expect(result.error).toBeUndefined();
    });

    it('should deny access for non-admin user', () => {
      const user = { role: 'user' };
      const result = requireAdmin(user);
      expect(result.error).toBeDefined();
      expect(result.error.statusCode).toBe(401);
    });
  });

  describe('requireOwnership', () => {
    it('should allow access for owner', () => {
      const user = { id: 1, role: 'user' };
      const result = requireOwnership(user, 1);
      expect(result.user).toBe(user);
    });

    it('should allow access for admin even if not owner', () => {
      const user = { id: 1, role: 'admin' };
      const result = requireOwnership(user, 2);
      expect(result.user).toBe(user);
    });

    it('should deny access if not owner and not admin', () => {
      const user = { id: 1, role: 'user' };
      const result = requireOwnership(user, 2);
      expect(result.error).toBeDefined();
    });
  });
});
