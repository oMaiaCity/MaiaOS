/**
 * StateEngine Unit Tests
 * Tests for state machine creation, transitions, guards, and tool invocation
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateEngine } from './state.engine.js';
import { MaiaScriptEvaluator } from '../MaiaScriptEvaluator.js';
import { ModuleRegistry } from '../ModuleRegistry.js';
import { ToolEngine } from '../tool-engine/tool.engine.js';

// Mock ToolEngine
class MockToolEngine {
  constructor() {
    this.executedTools = [];
    this.shouldFail = false;
  }

  async execute(toolName, actor, payload) {
    this.executedTools.push({ toolName, actor, payload });
    if (this.shouldFail) {
      throw new Error(`Tool ${toolName} failed`);
    }
  }

  reset() {
    this.executedTools = [];
    this.shouldFail = false;
  }
}

// Mock Actor
function createMockActor(id = 'actor_test_001') {
  return {
    id,
    context: {
      newTodoText: '',
      todos: [],
      viewMode: 'list'
    },
    actorEngine: {
      rerender: async () => {}
    }
  };
}

describe('StateEngine', () => {
  let stateEngine;
  let toolEngine;
  let evaluator;
  let moduleRegistry;

  beforeEach(() => {
    moduleRegistry = new ModuleRegistry();
    evaluator = new MaiaScriptEvaluator(moduleRegistry);
    toolEngine = new MockToolEngine();
    stateEngine = new StateEngine(toolEngine, evaluator);
  });

  describe('constructor', () => {
    it('should create StateEngine instance', () => {
      expect(stateEngine).toBeDefined();
      expect(stateEngine.toolEngine).toBe(toolEngine);
      expect(stateEngine.evaluator).toBe(evaluator);
      expect(stateEngine.machines).toBeInstanceOf(Map);
      expect(stateEngine.stateCache).toBeInstanceOf(Map);
    });
  });

  describe('loadStateDef', () => {
    it('should cache loaded state definitions', async () => {
      // Mock fetch
      global.fetch = async (path) => {
        if (path.includes('test_state')) {
          return {
            ok: true,
            json: async () => ({
              $type: 'state',
              initial: 'idle',
              states: { idle: {} }
            })
          };
        }
        throw new Error('Not found');
      };

      const def1 = await stateEngine.loadStateDef('test_state');
      const def2 = await stateEngine.loadStateDef('test_state');

      expect(def1).toBe(def2); // Should return cached version
      expect(stateEngine.stateCache.has('test_state')).toBe(true);
    });

    it('should throw error if state file not found', async () => {
      global.fetch = async () => ({
        ok: false
      });

      await expect(stateEngine.loadStateDef('nonexistent')).rejects.toThrow();
    });
  });

  describe('createMachine', () => {
    it('should create a state machine instance', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      expect(machine).toBeDefined();
      expect(machine.id).toBe(`${actor.id}_machine`);
      expect(machine.currentState).toBe('idle');
      expect(machine.context).toBe(actor.context);
      expect(machine.definition).toBe(stateDef);
      expect(stateEngine.machines.has(machine.id)).toBe(true);
    });

    it('should execute entry actions for initial state', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'loading',
        states: {
          loading: {
            entry: {
              tool: '@test/tool',
              payload: { test: 'value' }
            }
          }
        }
      };

      const actor = createMockActor();
      await stateEngine.createMachine(stateDef, actor);

      expect(toolEngine.executedTools.length).toBe(1);
      expect(toolEngine.executedTools[0].toolName).toBe('@test/tool');
    });

    it('should handle multiple entry actions', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'loading',
        states: {
          loading: {
            entry: [
              { tool: '@test/tool1', payload: {} },
              { tool: '@test/tool2', payload: {} }
            ],
            on: {
              SUCCESS: 'idle'
            }
          },
          idle: {}
        }
      };

      const actor = createMockActor();
      await stateEngine.createMachine(stateDef, actor);

      expect(toolEngine.executedTools.length).toBe(2);
    });
  });

  describe('send', () => {
    it('should handle event and transition to target state', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              CREATE_TODO: 'creating'
            }
          },
          creating: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'CREATE_TODO', {});

      expect(machine.currentState).toBe('creating');
    });

    it('should ignore events not handled in current state', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'UNHANDLED_EVENT', {});

      expect(machine.currentState).toBe('idle'); // Should remain unchanged
    });

    it('should evaluate guard before transitioning', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              CREATE_TODO: {
                target: 'creating',
                guard: { $ne: ['$newTodoText', ''] }
              }
            }
          },
          creating: {}
        }
      };

      const actor = createMockActor();
      actor.context.newTodoText = '';
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'CREATE_TODO', {});

      expect(machine.currentState).toBe('idle'); // Guard should prevent transition

      actor.context.newTodoText = 'Test';
      await stateEngine.send(machine.id, 'CREATE_TODO', {});

      expect(machine.currentState).toBe('creating'); // Guard should allow transition
    });

    it('should execute transition actions', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              UPDATE_INPUT: {
                target: 'idle',
                actions: [{
                  tool: '@context/update',
                  payload: { newTodoText: '$$value' }
                }]
              }
            }
          }
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'UPDATE_INPUT', { value: 'New text' });

      expect(toolEngine.executedTools.length).toBe(1);
      expect(toolEngine.executedTools[0].payload.newTodoText).toBe('New text');
    });

    it('should execute exit actions when leaving state', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            exit: {
              tool: '@test/exit',
              payload: {}
            },
            on: {
              TRANSITION: 'other'
            }
          },
          other: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'TRANSITION', {});

      expect(toolEngine.executedTools.length).toBe(1);
      expect(toolEngine.executedTools[0].toolName).toBe('@test/exit');
    });

    it('should record transition history', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              TRANSITION: 'other'
            }
          },
          other: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'TRANSITION', {});

      expect(machine.history.length).toBe(1);
      expect(machine.history[0].from).toBe('idle');
      expect(machine.history[0].to).toBe('other');
      expect(machine.history[0].event).toBe('TRANSITION');
    });
  });

  describe('tool invocation', () => {
    it('should auto-send SUCCESS event on tool success', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'creating',
        states: {
          creating: {
            entry: {
              tool: '@test/tool',
              payload: {}
            },
            on: {
              SUCCESS: 'idle'
            }
          },
          idle: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(machine.currentState).toBe('idle');
    });

    it('should auto-send ERROR event on tool failure', async () => {
      toolEngine.shouldFail = true;

      const stateDef = {
        $type: 'state',
        initial: 'creating',
        states: {
          creating: {
            entry: {
              tool: '@test/tool',
              payload: {}
            },
            on: {
              ERROR: 'error'
            }
          },
          error: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(machine.currentState).toBe('error');
    });

    it('should evaluate payload expressions', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              CREATE_TODO: {
                target: 'creating',
                actions: [{
                  tool: '@test/tool',
                  payload: {
                    text: '$newTodoText',
                    mode: '$viewMode'
                  }
                }]
              }
            }
          },
          creating: {}
        }
      };

      const actor = createMockActor();
      actor.context.newTodoText = 'Test todo';
      actor.context.viewMode = 'list';
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'CREATE_TODO', {});

      expect(toolEngine.executedTools[0].payload.text).toBe('Test todo');
      expect(toolEngine.executedTools[0].payload.mode).toBe('list');
    });

    it('should resolve event payload with $$ syntax', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              UPDATE_TODO: {
                target: 'idle',
                actions: [{
                  tool: '@test/tool',
                  payload: {
                    id: '$$id',
                    text: '$$text'
                  }
                }]
              }
            }
          }
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'UPDATE_TODO', { id: '123', text: 'Updated' });

      expect(toolEngine.executedTools[0].payload.id).toBe('123');
      expect(toolEngine.executedTools[0].payload.text).toBe('Updated');
    });
  });

  describe('guard evaluation', () => {
    it('should support boolean guards', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              TEST: {
                target: 'other',
                guard: false
              }
            }
          },
          other: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'TEST', {});

      expect(machine.currentState).toBe('idle'); // Guard should prevent transition
    });

    it('should support $eq guard', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              TEST: {
                target: 'other',
                guard: { $eq: ['$viewMode', 'list'] }
              }
            }
          },
          other: {}
        }
      };

      const actor = createMockActor();
      actor.context.viewMode = 'kanban';
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'TEST', {});

      expect(machine.currentState).toBe('idle'); // Guard should fail

      actor.context.viewMode = 'list';
      await stateEngine.send(machine.id, 'TEST', {});

      expect(machine.currentState).toBe('other'); // Guard should pass
    });

    it('should support $ne guard', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              TEST: {
                target: 'other',
                guard: { $ne: ['$newTodoText', ''] }
              }
            }
          },
          other: {}
        }
      };

      const actor = createMockActor();
      actor.context.newTodoText = '';
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'TEST', {});

      expect(machine.currentState).toBe('idle'); // Guard should fail

      actor.context.newTodoText = 'Test';
      await stateEngine.send(machine.id, 'TEST', {});

      expect(machine.currentState).toBe('other'); // Guard should pass
    });
  });

  describe('getCurrentState', () => {
    it('should return current state of machine', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              TRANSITION: 'other'
            }
          },
          other: {}
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      expect(stateEngine.getCurrentState(machine.id)).toBe('idle');

      await stateEngine.send(machine.id, 'TRANSITION', {});

      expect(stateEngine.getCurrentState(machine.id)).toBe('other');
    });

    it('should return null for non-existent machine', () => {
      expect(stateEngine.getCurrentState('nonexistent')).toBeNull();
    });
  });

  describe('getMachine', () => {
    it('should return machine instance', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: { idle: {} }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      expect(stateEngine.getMachine(machine.id)).toBe(machine);
    });

    it('should return null for non-existent machine', () => {
      expect(stateEngine.getMachine('nonexistent')).toBeNull();
    });
  });

  describe('destroyMachine', () => {
    it('should remove machine from registry', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: { idle: {} }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      expect(stateEngine.machines.has(machine.id)).toBe(true);

      stateEngine.destroyMachine(machine.id);

      expect(stateEngine.machines.has(machine.id)).toBe(false);
    });
  });

  describe('self-transitions', () => {
    it('should execute actions on self-transition', async () => {
      const stateDef = {
        $type: 'state',
        initial: 'idle',
        states: {
          idle: {
            on: {
              UPDATE_INPUT: {
                target: 'idle',
                actions: [{
                  tool: '@context/update',
                  payload: { newTodoText: '$$value' }
                }]
              }
            }
          }
        }
      };

      const actor = createMockActor();
      const machine = await stateEngine.createMachine(stateDef, actor);

      await stateEngine.send(machine.id, 'UPDATE_INPUT', { value: 'New' });

      expect(machine.currentState).toBe('idle'); // State unchanged
      expect(toolEngine.executedTools.length).toBe(1); // But action executed
    });
  });
});
