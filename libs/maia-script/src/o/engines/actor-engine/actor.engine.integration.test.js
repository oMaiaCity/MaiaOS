/**
 * ActorEngine Tests
 * Tests for actor interface validation and loading
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { MaiaOS } from '../../kernel.js';

describe('ActorEngine - Interface Validation', () => {
  let os;

  beforeAll(async () => {
    // Boot MaiaOS with interface module
    // Tools path relative to ToolEngine.js location (src/o/engines/tool-engine/)
    // Tools are at: src/o/tools/
    // So relative path from tool-engine/ to tools/ is: ../../tools
    os = await MaiaOS.boot({
      modules: ['core', 'interface'],
      toolsPath: '../../tools'
    });
  });

  it('should load interface module successfully', () => {
    const modules = os.moduleRegistry.listModules();
    expect(modules).toContain('interface');
  });

  it('should register @interface/validateInterface tool', () => {
    expect(os.toolEngine.tools.has('@interface/validateInterface')).toBe(true);
  });

  it('should validate valid interface schema', async () => {
    const validInterface = {
      $type: 'actor.interface',
      inbox: {
        CREATE_TODO: {
          payload: { text: 'string' }
        }
      },
      publishes: {
        TODO_CREATED: {
          payload: { id: 'string', text: 'string' }
        }
      },
      subscriptions: ['actor_parent_001'],
      watermark: 0
    };

    const mockActor = {
      context: {}
    };

    await os.toolEngine.execute('@interface/validateInterface', mockActor, {
      interfaceDef: validInterface,
      actorId: 'test_actor_001'
    });

    expect(mockActor.context._interfaceValidation).toBeDefined();
    expect(mockActor.context._interfaceValidation.valid).toBe(true);
    expect(mockActor.context._interfaceValidation.errors).toHaveLength(0);
  });

  it('should detect invalid $type', async () => {
    const invalidInterface = {
      $type: 'wrong.type',
      inbox: {}
    };

    const mockActor = {
      context: {}
    };

    await os.toolEngine.execute('@interface/validateInterface', mockActor, {
      interfaceDef: invalidInterface,
      actorId: 'test_actor_002'
    });

    expect(mockActor.context._interfaceValidation.valid).toBe(false);
    expect(mockActor.context._interfaceValidation.errors).toContain('$type must be "actor.interface"');
  });

  it('should warn about missing payload schemas', async () => {
    const interfaceWithoutPayload = {
      $type: 'actor.interface',
      inbox: {
        SOME_EVENT: {}
      }
    };

    const mockActor = {
      context: {}
    };

    await os.toolEngine.execute('@interface/validateInterface', mockActor, {
      interfaceDef: interfaceWithoutPayload,
      actorId: 'test_actor_003'
    });

    expect(mockActor.context._interfaceValidation.warnings).toContain('inbox.SOME_EVENT missing payload schema');
  });

  it('should validate subscriptions array', async () => {
    const invalidSubscriptions = {
      $type: 'actor.interface',
      subscriptions: 'not_an_array'
    };

    const mockActor = {
      context: {}
    };

    await os.toolEngine.execute('@interface/validateInterface', mockActor, {
      interfaceDef: invalidSubscriptions,
      actorId: 'test_actor_004'
    });

    expect(mockActor.context._interfaceValidation.errors).toContain('subscriptions must be an array');
  });

  it('should validate watermark type', async () => {
    const invalidWatermark = {
      $type: 'actor.interface',
      watermark: 'not_a_number'
    };

    const mockActor = {
      context: {}
    };

    await os.toolEngine.execute('@interface/validateInterface', mockActor, {
      interfaceDef: invalidWatermark,
      actorId: 'test_actor_005'
    });

    expect(mockActor.context._interfaceValidation.errors).toContain('watermark must be a number (timestamp)');
  });
});
