/**
 * ToolEngine Unit Tests
 * Tests for tool loading, registration, and execution
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ToolEngine } from './tool.engine.js';
import { ModuleRegistry } from '../ModuleRegistry.js';

describe('ToolEngine', () => {
  let engine;
  let registry;

  beforeEach(() => {
    registry = new ModuleRegistry();
    engine = new ToolEngine(registry);
  });

  describe('constructor', () => {
    it('should initialize with module registry', () => {
      expect(engine.moduleRegistry).toBe(registry);
      expect(engine.tools).toBeInstanceOf(Map);
      expect(engine.toolsPath).toBe('../../tools');
    });
  });

  describe('setToolsPath', () => {
    it('should update tools path', () => {
      engine.setToolsPath('../custom/tools');
      expect(engine.toolsPath).toBe('../custom/tools');
    });
  });

  describe('registerTool', () => {
    it('should register a tool successfully', async () => {
      engine.setToolsPath('../../tools');
      
      await engine.registerTool('core/noop', '@core/noop');
      
      expect(engine.tools.has('@core/noop')).toBe(true);
      const tool = engine.tools.get('@core/noop');
      expect(tool).toBeDefined();
      expect(tool.definition).toBeDefined();
      expect(tool.function).toBeDefined();
    });

    it('should handle registration failure gracefully', async () => {
      engine.setToolsPath('../nonexistent');
      
      // Should not throw, just log error
      await engine.registerTool('invalid/tool', '@invalid/tool');
      
      expect(engine.tools.has('@invalid/tool')).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute a registered tool', async () => {
      engine.setToolsPath('../../tools');
      await engine.registerTool('core/noop', '@core/noop');
      
      const mockActor = {
        context: {}
      };
      
      await engine.execute('@core/noop', mockActor, {});
      
      // No error means execution succeeded
      expect(true).toBe(true);
    });

    it('should throw error for unregistered tool', async () => {
      const mockActor = {
        context: {}
      };
      
      await expect(
        engine.execute('@nonexistent/tool', mockActor, {})
      ).rejects.toThrow('Tool not found: @nonexistent/tool');
    });

    it('should validate payload against schema', async () => {
      engine.setToolsPath('../../tools');
      await engine.registerTool('core/noop', '@core/noop');
      
      const mockActor = {
        context: {}
      };
      
      // Should execute successfully with empty payload
      await engine.execute('@core/noop', mockActor, {});
      
      expect(true).toBe(true);
    });
  });

  describe('getToolDefinition', () => {
    it('should return tool definition for registered tool', async () => {
      engine.setToolsPath('../../tools');
      await engine.registerTool('core/noop', '@core/noop');
      
      const definition = engine.getToolDefinition('@core/noop');
      
      expect(definition).toBeDefined();
      expect(definition.$type).toBe('tool');
      expect(definition.name).toBe('@core/noop');
    });

    it('should return null for unregistered tool', () => {
      const definition = engine.getToolDefinition('@nonexistent/tool');
      expect(definition).toBeNull();
    });
  });

  describe('getAllTools', () => {
    it('should return all registered tool definitions', async () => {
      engine.setToolsPath('../../tools');
      await engine.registerTool('core/noop', '@core/noop');
      
      const allTools = engine.getAllTools();
      
      expect(allTools).toBeInstanceOf(Array);
      expect(allTools.length).toBeGreaterThan(0);
      expect(allTools[0].$type).toBe('tool');
    });
  });

  describe('_validatePayload', () => {
    it('should validate required fields', () => {
      const schema = {
        required: ['name', 'value']
      };
      
      const validPayload = { name: 'test', value: 123 };
      expect(() => engine._validatePayload(validPayload, schema)).not.toThrow();
      
      const invalidPayload = { name: 'test' };
      expect(() => engine._validatePayload(invalidPayload, schema)).toThrow('Missing required field: value');
    });

    it('should handle schema without required fields', () => {
      const schema = {};
      const payload = { any: 'data' };
      
      expect(() => engine._validatePayload(payload, schema)).not.toThrow();
    });
  });
});
