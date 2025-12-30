const { 
  validate, 
  userSchemas, 
  sanitizeString, 
  isValidEmail, 
  isValidUUID 
} = require('../validation');

describe('Validation Module', () => {
  describe('validate function', () => {
    it('should return isValid true for correct data', () => {
      const schema = userSchemas.login;
      const data = { email: 'test@example.com', password: 'password123' };
      
      const result = validate(schema, data);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should return isValid false for incorrect data', () => {
      const schema = userSchemas.login;
      const data = { email: 'not-an-email', password: '' };
      
      const result = validate(schema, data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('sanitizeString', () => {
    it('should remove SQL-like characters', () => {
      const input = "DROP TABLE users; -- ' OR 1=1";
      const result = sanitizeString(input);
      expect(result).not.toContain('DROP TABLE');
      expect(result).not.toContain(';');
      expect(result).not.toContain("'");
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@sub.domain.co')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missing-user.com')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid v4 UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return false for invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });
  });
});
