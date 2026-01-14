import { describe, it, expect, beforeEach } from 'bun:test';
import { ViewEngine } from './view.engine.js';
import { MaiaScriptEvaluator } from '../MaiaScriptEvaluator.js';

// Bun test provides DOM globals, but if not available, we'll skip DOM-dependent tests
// For now, tests that require DOM will need to run in browser environment

describe('ViewEngine', () => {
  let viewEngine;
  let evaluator;

  beforeEach(() => {
    evaluator = new MaiaScriptEvaluator();
    viewEngine = new ViewEngine(evaluator, null, null);
  });

  describe('Data-Attribute Mapping', () => {
    it('should render data-attribute from string shorthand', () => {
      const node = {
        class: 'test',
        attrs: {
          'data': '$dragOverColumn'
        }
      };
      const context = { dragOverColumn: 'todo' };
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.getAttribute('data-drag-over-column')).toBe('todo');
    });

    it('should convert camelCase to kebab-case for data-attributes', () => {
      const node = {
        attrs: {
          'data': '$dragOverColumn'
        }
      };
      const context = { dragOverColumn: 'todo' };
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.hasAttribute('data-drag-over-column')).toBe(true);
      expect(element.hasAttribute('data-dragOverColumn')).toBe(false);
    });

    it('should omit data-attribute when context value is null', () => {
      const node = {
        attrs: {
          'data': '$dragOverColumn'
        }
      };
      const context = { dragOverColumn: null };
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.hasAttribute('data-drag-over-column')).toBe(false);
    });

    it('should omit data-attribute when context value is undefined', () => {
      const node = {
        attrs: {
          'data': '$dragOverColumn'
        }
      };
      const context = {};
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.hasAttribute('data-drag-over-column')).toBe(false);
    });

    it('should handle multiple data attributes with object syntax', () => {
      const node = {
        attrs: {
          'data': {
            'dragOver': '$dragOverColumn',
            'itemId': '$draggedItemId'
          }
        }
      };
      const context = {
        dragOverColumn: 'todo',
        draggedItemId: 'item-123'
      };
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.getAttribute('data-drag-over')).toBe('todo');
      expect(element.getAttribute('data-item-id')).toBe('item-123');
    });

    it('should handle data-attribute with item context ($$id)', () => {
      const node = {
        attrs: {
          'data': '$$id'
        }
      };
      const context = {};
      const item = { id: 'todo-456' };
      const element = viewEngine.renderNode(node, { context, item }, 'test-actor');

      expect(element.getAttribute('data-id')).toBe('todo-456');
    });

    it('should handle comparison syntax in data-attributes', () => {
      const node = {
        attrs: {
          'data': {
            'isDragged': { '$eq': ['$draggedItemId', '$$id'] }
          }
        }
      };
      const context = { draggedItemId: 'item-123' };
      const item = { id: 'item-123' };
      const element = viewEngine.renderNode(node, { context, item }, 'test-actor');

      expect(element.getAttribute('data-is-dragged')).toBe('true');
    });

    it('should omit data-attribute when comparison is false', () => {
      const node = {
        attrs: {
          'data': {
            'isDragged': { '$eq': ['$draggedItemId', '$$id'] }
          }
        }
      };
      const context = { draggedItemId: 'item-123' };
      const item = { id: 'item-456' };
      const element = viewEngine.renderNode(node, { context, item }, 'test-actor');

      expect(element.hasAttribute('data-is-dragged')).toBe(false);
    });
  });

  describe('$if Removal', () => {
    it('should throw error when $if is used in class property', () => {
      const node = {
        class: {
          '$if': {
            condition: { '$eq': ['$dragOverColumn', 'todo'] },
            then: 'active',
            else: 'inactive'
          }
        }
      };
      const context = { dragOverColumn: 'todo' };

      expect(() => {
        viewEngine.renderNode(node, { context }, 'test-actor');
      }).toThrow();
    });

    it('should throw error when $if is used in children array', () => {
      const node = {
        children: [
          {
            '$if': {
              condition: true,
              then: { tag: 'div', text: 'shown' },
              else: null
            }
          }
        ]
      };
      const context = {};

      expect(() => {
        viewEngine.renderNode(node, { context }, 'test-actor');
      }).toThrow();
    });
  });

  describe('$slot Migration', () => {
    it('should support $slot syntax', () => {
      const node = {
        '$slot': '$currentView',
        tag: 'main',
        class: 'content'
      };
      const context = { currentView: '@list' };
      
      // Mock actorEngine for slot rendering
      const mockActorEngine = {
        getActor: () => ({
          children: {
            list: {
              containerElement: document.createElement('div')
            }
          }
        })
      };
      viewEngine.setActorEngine(mockActorEngine);

      const element = viewEngine.renderNode(node, { context }, 'test-actor');
      
      expect(element.tagName.toLowerCase()).toBe('main');
      expect(element.className).toBe('content');
    });

    it('should throw error when old slot syntax is used', () => {
      const node = {
        slot: '$currentView'
      };
      const context = { currentView: '@list' };

      expect(() => {
        viewEngine.renderNode(node, { context }, 'test-actor');
      }).toThrow();
    });
  });

  describe('Allowed Operations', () => {
    it('should support $each', () => {
      const node = {
        '$each': {
          items: '$items',
          template: {
            tag: 'div',
            text: '$$text'
          }
        }
      };
      const context = {
        items: [
          { text: 'Item 1' },
          { text: 'Item 2' }
        ]
      };
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.children.length).toBe(2);
      expect(element.children[0].textContent).toBe('Item 1');
      expect(element.children[1].textContent).toBe('Item 2');
    });

    it('should support $contextKey references', () => {
      const node = {
        text: '$title'
      };
      const context = { title: 'Hello World' };
      const element = viewEngine.renderNode(node, { context }, 'test-actor');

      expect(element.textContent).toBe('Hello World');
    });

    it('should support $on event handlers', () => {
      let clicked = false;
      const node = {
        tag: 'button',
        '$on': {
          click: {
            send: 'TEST_EVENT',
            payload: {}
          }
        }
      };
      const context = {};
      
      // Mock actorEngine for event handling
      const mockActorEngine = {
        getActor: () => ({
          machine: {
            id: 'test-machine'
          }
        }),
        stateEngine: {
          send: () => { clicked = true; }
        }
      };
      viewEngine.setActorEngine(mockActorEngine);

      const element = viewEngine.renderNode(node, { context }, 'test-actor');
      element.click();

      expect(clicked).toBe(true);
    });
  });
});
