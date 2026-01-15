import { describe, it, expect, beforeEach } from 'bun:test';
import { ValidationEngine } from './validation.engine.js';

describe('ValidationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ValidationEngine();
  });

  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(engine).toBeDefined();
      expect(engine.ajv).toBeDefined();
    });
  });

  describe('loadSchema', () => {
    it('should load a schema successfully', () => {
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };

      engine.loadSchema('test', schema);
      expect(engine.hasSchema('test')).toBe(true);
    });

    it('should cache compiled schemas', () => {
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      engine.loadSchema('test', schema);
      const firstLoad = engine.schemas.get('test');
      engine.loadSchema('test', schema);
      const secondLoad = engine.schemas.get('test');
      
      // Should be the same compiled schema instance
      expect(firstLoad).toBe(secondLoad);
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };
      engine.loadSchema('person', schema);
    });

    it('should validate valid data', () => {
      const data = { name: 'John', age: 30 };
      const result = engine.validate('person', data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should reject invalid data with clear errors', () => {
      const data = { age: 30 }; // missing required 'name'
      const result = engine.validate('person', data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].instancePath).toBeDefined();
    });

    it('should reject data with wrong types', () => {
      const data = { name: 123, age: 'thirty' }; // wrong types
      const result = engine.validate('person', data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject data violating constraints', () => {
      const data = { name: 'John', age: -5 }; // age < 0
      const result = engine.validate('person', data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validate with missing schema', () => {
    it('should handle missing schema gracefully', () => {
      const data = { name: 'John' };
      
      expect(() => {
        engine.validate('nonexistent', data);
      }).toThrow();
    });
  });

  describe('hasSchema', () => {
    it('should return false for unloaded schema', () => {
      expect(engine.hasSchema('nonexistent')).toBe(false);
    });

    it('should return true for loaded schema', () => {
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object'
      };
      engine.loadSchema('test', schema);
      expect(engine.hasSchema('test')).toBe(true);
    });
  });

  describe('error formatting', () => {
    beforeEach(() => {
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            minLength: 3,
            title: 'Name',
            description: 'Person name'
          }
        },
        required: ['name']
      };
      engine.loadSchema('person', schema);
    });

    it('should include schema path in errors', () => {
      const data = {};
      const result = engine.validate('person', data);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].instancePath).toBeDefined();
      expect(result.errors[0].schemaPath).toBeDefined();
    });

    it('should include error message', () => {
      const data = { name: 'ab' }; // too short
      const result = engine.validate('person', data);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBeDefined();
    });
  });
});
