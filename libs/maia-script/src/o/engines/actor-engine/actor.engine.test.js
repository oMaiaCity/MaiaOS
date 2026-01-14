/**
 * ActorEngine Unit Tests
 * Tests for actor lifecycle, message passing, and core functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ActorEngine } from './actor.engine.js';
import { StyleEngine } from '../style-engine/style.engine.js';
import { ViewEngine } from '../ViewEngine.js';
import { ModuleRegistry } from '../ModuleRegistry.js';
import { ToolEngine } from '../tool-engine/tool.engine.js';

describe('ActorEngine', () => {
  let engine;
  let styleEngine;
  let viewEngine;
  let moduleRegistry;
  let toolEngine;

  beforeEach(() => {
    styleEngine = new StyleEngine();
    moduleRegistry = new ModuleRegistry();
    toolEngine = new ToolEngine(moduleRegistry);
    viewEngine = new ViewEngine(null, null, moduleRegistry);
    engine = new ActorEngine(styleEngine, viewEngine, moduleRegistry, toolEngine);
  });

  describe('constructor', () => {
    it('should initialize with all required engines', () => {
      expect(engine.styleEngine).toBe(styleEngine);
      expect(engine.viewEngine).toBe(viewEngine);
      expect(engine.registry).toBe(moduleRegistry);
      expect(engine.toolEngine).toBe(toolEngine);
      expect(engine.actors).toBeInstanceOf(Map);
    });

    it('should set actor engine reference in view engine', () => {
      expect(viewEngine.actorEngine).toBe(engine);
    });
  });

  describe('resolveActorIdToFilename', () => {
    it('should resolve actor ID to filename', () => {
      expect(engine.resolveActorIdToFilename('actor_view_switcher_001')).toBe('view_switcher');
      expect(engine.resolveActorIdToFilename('actor_todo_input_001')).toBe('todo_input');
    });

    it('should handle actor IDs without prefix', () => {
      expect(engine.resolveActorIdToFilename('view_switcher')).toBe('view_switcher');
    });

    it('should handle actor IDs with different suffixes', () => {
      expect(engine.resolveActorIdToFilename('actor_test_002')).toBe('test');
      expect(engine.resolveActorIdToFilename('actor_test_999')).toBe('test');
    });
  });

  describe('getActor', () => {
    it('should return actor by ID', () => {
      const mockActor = {
        id: 'test_actor_001',
        config: {},
        context: {}
      };
      engine.actors.set('test_actor_001', mockActor);

      const actor = engine.getActor('test_actor_001');
      expect(actor).toBe(mockActor);
    });

    it('should return undefined for non-existent actor', () => {
      const actor = engine.getActor('nonexistent_actor');
      expect(actor).toBeUndefined();
    });
  });

  describe('destroyActor', () => {
    it('should remove actor from registry', () => {
      // Mock shadowRoot (not available in Bun test environment)
      const mockShadowRoot = {
        innerHTML: ''
      };
      
      const mockActor = {
        id: 'test_actor_001',
        shadowRoot: mockShadowRoot,
        machine: null
      };
      engine.actors.set('test_actor_001', mockActor);

      engine.destroyActor('test_actor_001');

      expect(engine.actors.has('test_actor_001')).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should add message to actor inbox', () => {
      const mockActor = {
        id: 'test_actor_001',
        inbox: [],
        interface: null
      };
      engine.actors.set('test_actor_001', mockActor);

      const message = {
        type: 'TEST_MESSAGE',
        payload: { data: 'test' }
      };

      engine.sendMessage('test_actor_001', message);

      expect(mockActor.inbox.length).toBe(1);
      expect(mockActor.inbox[0].type).toBe('TEST_MESSAGE');
      expect(mockActor.inbox[0].timestamp).toBeDefined();
    });

    it('should validate message against interface', () => {
      const mockActor = {
        id: 'test_actor_001',
        inbox: [],
        interface: {
          inbox: {
            TEST_MESSAGE: {
              payload: { data: 'string' }
            }
          }
        }
      };
      engine.actors.set('test_actor_001', mockActor);

      const validMessage = {
        type: 'TEST_MESSAGE',
        payload: { data: 'test' }
      };

      engine.sendMessage('test_actor_001', validMessage);
      expect(mockActor.inbox.length).toBe(1);
    });
  });

  describe('publishMessage', () => {
    it('should publish message to subscribed actors', () => {
      const mockActor1 = {
        id: 'actor_1',
        subscriptions: ['actor_2'],
        interface: null
      };
      const mockActor2 = {
        id: 'actor_2',
        inbox: [],
        interface: null
      };

      engine.actors.set('actor_1', mockActor1);
      engine.actors.set('actor_2', mockActor2);

      engine.publishMessage('actor_1', 'TEST_EVENT', { data: 'test' });

      expect(mockActor2.inbox.length).toBe(1);
      expect(mockActor2.inbox[0].type).toBe('TEST_EVENT');
      expect(mockActor2.inbox[0].from).toBe('actor_1');
    });
  });
});
