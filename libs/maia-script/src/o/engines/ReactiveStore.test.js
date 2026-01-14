import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ReactiveStore } from './ReactiveStore.js';

// Mock localStorage for Bun tests
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

// Set up global localStorage mock
global.localStorage = new LocalStorageMock();

describe('ReactiveStore', () => {
  let store;
  const testStorageKey = 'test_maiaos_data';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    store = new ReactiveStore(testStorageKey);
  });

  afterEach(() => {
    // Clean up
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should create ReactiveStore instance', () => {
      expect(store).toBeDefined();
      expect(store.storageKey).toBe(testStorageKey);
    });

    it('should initialize empty localStorage if not exists', () => {
      const data = localStorage.getItem(testStorageKey);
      expect(data).toBe('{}');
    });

    it('should not overwrite existing localStorage data', () => {
      localStorage.setItem(testStorageKey, JSON.stringify({ todos: [{ id: '1', text: 'Test' }] }));
      const newStore = new ReactiveStore(testStorageKey);
      const data = newStore.getCollection('todos');
      expect(data).toEqual([{ id: '1', text: 'Test' }]);
    });
  });

  describe('getCollection', () => {
    it('should return empty array for non-existent collection', () => {
      const data = store.getCollection('todos');
      expect(data).toEqual([]);
    });

    it('should return collection data', () => {
      const todos = [
        { id: '1', text: 'Test 1', done: false },
        { id: '2', text: 'Test 2', done: true }
      ];
      store.setCollection('todos', todos);
      
      const result = store.getCollection('todos');
      expect(result).toEqual(todos);
    });
  });

  describe('setCollection', () => {
    it('should save collection to localStorage', () => {
      const todos = [{ id: '1', text: 'Test', done: false }];
      store.setCollection('todos', todos);
      
      const raw = localStorage.getItem(testStorageKey);
      const data = JSON.parse(raw);
      expect(data.todos).toEqual(todos);
    });

    it('should preserve other collections when updating one', () => {
      store.setCollection('todos', [{ id: '1', text: 'Todo' }]);
      store.setCollection('notes', [{ id: '1', text: 'Note' }]);
      
      const todos = store.getCollection('todos');
      const notes = store.getCollection('notes');
      
      expect(todos).toEqual([{ id: '1', text: 'Todo' }]);
      expect(notes).toEqual([{ id: '1', text: 'Note' }]);
    });
  });

  describe('subscribe', () => {
    it('should call callback immediately with current data', () => {
      const todos = [{ id: '1', text: 'Test', done: false }];
      store.setCollection('todos', todos);
      
      let receivedData = null;
      store.subscribe('todos', null, (data) => {
        receivedData = data;
      });
      
      expect(receivedData).toEqual(todos);
    });

    it('should call callback when collection changes', () => {
      let callCount = 0;
      let receivedData = null;
      
      store.subscribe('todos', null, (data) => {
        callCount++;
        receivedData = data;
      });
      
      const todos = [{ id: '1', text: 'Test', done: false }];
      store.setCollection('todos', todos);
      
      expect(callCount).toBe(2); // Once on subscribe, once on setCollection
      expect(receivedData).toEqual(todos);
    });

    it('should support multiple observers for same collection', () => {
      let callback1Data = null;
      let callback2Data = null;
      
      store.subscribe('todos', null, (data) => { callback1Data = data; });
      store.subscribe('todos', null, (data) => { callback2Data = data; });
      
      const todos = [{ id: '1', text: 'Test', done: false }];
      store.setCollection('todos', todos);
      
      expect(callback1Data).toEqual(todos);
      expect(callback2Data).toEqual(todos);
    });

    it('should return unsubscribe function', () => {
      let callCount = 0;
      
      const unsubscribe = store.subscribe('todos', null, () => {
        callCount++;
      });
      
      expect(callCount).toBe(1); // Initial call
      
      store.setCollection('todos', [{ id: '1', text: 'Test' }]);
      expect(callCount).toBe(2); // Notified
      
      unsubscribe();
      
      store.setCollection('todos', [{ id: '2', text: 'Test 2' }]);
      expect(callCount).toBe(2); // Not notified after unsubscribe
    });

    it('should clean up observers map when all unsubscribed', () => {
      const unsub1 = store.subscribe('todos', null, () => {});
      const unsub2 = store.subscribe('todos', null, () => {});
      
      expect(store.getObservers().has('todos')).toBe(true);
      
      unsub1();
      expect(store.getObservers().has('todos')).toBe(true);
      
      unsub2();
      expect(store.getObservers().has('todos')).toBe(false);
    });
  });

  describe('notify', () => {
    it('should notify all observers of a schema', () => {
      let callback1Count = 0;
      let callback2Count = 0;
      
      store.subscribe('todos', null, () => { callback1Count++; });
      store.subscribe('todos', null, () => { callback2Count++; });
      
      expect(callback1Count).toBe(1); // Initial
      expect(callback2Count).toBe(1); // Initial
      
      store.notify('todos');
      
      expect(callback1Count).toBe(2);
      expect(callback2Count).toBe(2);
    });

    it('should not notify observers of other schemas', () => {
      let todosCount = 0;
      let notesCount = 0;
      
      store.subscribe('todos', null, () => { todosCount++; });
      store.subscribe('notes', null, () => { notesCount++; });
      
      expect(todosCount).toBe(1);
      expect(notesCount).toBe(1);
      
      store.notify('todos');
      
      expect(todosCount).toBe(2);
      expect(notesCount).toBe(1); // Not notified
    });
  });

  describe('query', () => {
    beforeEach(() => {
      const todos = [
        { id: '1', text: 'Todo 1', done: false, priority: 1 },
        { id: '2', text: 'Todo 2', done: true, priority: 2 },
        { id: '3', text: 'Todo 3', done: false, priority: 3 },
        { id: '4', text: 'Test Todo', done: true, priority: 1 }
      ];
      store.setCollection('todos', todos);
    });

    it('should return all items when no filter provided', () => {
      const result = store.query('todos', null);
      expect(result.length).toBe(4);
    });

    it('should filter by eq (equals)', () => {
      const result = store.query('todos', { field: 'done', op: 'eq', value: false });
      expect(result.length).toBe(2);
      expect(result.every(item => item.done === false)).toBe(true);
    });

    it('should filter by ne (not equals)', () => {
      const result = store.query('todos', { field: 'done', op: 'ne', value: false });
      expect(result.length).toBe(2);
      expect(result.every(item => item.done === true)).toBe(true);
    });

    it('should filter by gt (greater than)', () => {
      const result = store.query('todos', { field: 'priority', op: 'gt', value: 1 });
      expect(result.length).toBe(2);
      expect(result.every(item => item.priority > 1)).toBe(true);
    });

    it('should filter by lt (less than)', () => {
      const result = store.query('todos', { field: 'priority', op: 'lt', value: 3 });
      expect(result.length).toBe(3);
      expect(result.every(item => item.priority < 3)).toBe(true);
    });

    it('should filter by gte (greater than or equal)', () => {
      const result = store.query('todos', { field: 'priority', op: 'gte', value: 2 });
      expect(result.length).toBe(2);
      expect(result.every(item => item.priority >= 2)).toBe(true);
    });

    it('should filter by lte (less than or equal)', () => {
      const result = store.query('todos', { field: 'priority', op: 'lte', value: 2 });
      expect(result.length).toBe(3);
      expect(result.every(item => item.priority <= 2)).toBe(true);
    });

    it('should filter by in (value in array)', () => {
      const result = store.query('todos', { 
        field: 'id', 
        op: 'in', 
        value: ['1', '3'] 
      });
      expect(result.length).toBe(2);
      expect(result.map(item => item.id)).toEqual(['1', '3']);
    });

    it('should filter by contains (string contains)', () => {
      const result = store.query('todos', { 
        field: 'text', 
        op: 'contains', 
        value: 'Test' 
      });
      expect(result.length).toBe(1);
      expect(result[0].text).toBe('Test Todo');
    });

    it('should return all items for unknown operator', () => {
      const result = store.query('todos', { 
        field: 'done', 
        op: 'unknown', 
        value: false 
      });
      expect(result.length).toBe(4);
    });
  });

  describe('subscribe with filter', () => {
    it('should only notify with filtered data', () => {
      const todos = [
        { id: '1', text: 'Todo 1', done: false },
        { id: '2', text: 'Todo 2', done: true },
        { id: '3', text: 'Todo 3', done: false }
      ];
      store.setCollection('todos', todos);
      
      let receivedData = null;
      store.subscribe('todos', { field: 'done', op: 'eq', value: false }, (data) => {
        receivedData = data;
      });
      
      expect(receivedData.length).toBe(2);
      expect(receivedData.every(item => item.done === false)).toBe(true);
    });

    it('should update filtered data when collection changes', () => {
      let receivedData = null;
      
      store.subscribe('todos', { field: 'done', op: 'eq', value: false }, (data) => {
        receivedData = data;
      });
      
      expect(receivedData).toEqual([]);
      
      const todos = [
        { id: '1', text: 'Todo 1', done: false },
        { id: '2', text: 'Todo 2', done: true },
        { id: '3', text: 'Todo 3', done: false }
      ];
      store.setCollection('todos', todos);
      
      expect(receivedData.length).toBe(2);
      expect(receivedData.every(item => item.done === false)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all data from localStorage', () => {
      store.setCollection('todos', [{ id: '1', text: 'Test' }]);
      store.setCollection('notes', [{ id: '1', text: 'Note' }]);
      
      store.clear();
      
      expect(store.getCollection('todos')).toEqual([]);
      expect(store.getCollection('notes')).toEqual([]);
    });

    it('should notify all observers with empty arrays', () => {
      store.setCollection('todos', [{ id: '1', text: 'Test' }]);
      
      let receivedData = null;
      store.subscribe('todos', null, (data) => {
        receivedData = data;
      });
      
      expect(receivedData.length).toBe(1);
      
      store.clear();
      
      expect(receivedData).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle corrupted localStorage data', () => {
      localStorage.setItem(testStorageKey, 'invalid json');
      const newStore = new ReactiveStore(testStorageKey);
      
      const result = newStore.getCollection('todos');
      expect(result).toEqual([]);
    });

    it('should handle empty collection names', () => {
      store.setCollection('', [{ id: '1' }]);
      const result = store.getCollection('');
      expect(result).toEqual([{ id: '1' }]);
    });

    it('should handle multiple filters on same collection', () => {
      const todos = [
        { id: '1', done: false },
        { id: '2', done: true },
        { id: '3', done: false }
      ];
      store.setCollection('todos', todos);
      
      let doneData = null;
      let notDoneData = null;
      
      store.subscribe('todos', { field: 'done', op: 'eq', value: true }, (data) => {
        doneData = data;
      });
      
      store.subscribe('todos', { field: 'done', op: 'eq', value: false }, (data) => {
        notDoneData = data;
      });
      
      expect(doneData.length).toBe(1);
      expect(notDoneData.length).toBe(2);
      
      // Add new todo
      const newTodos = [...todos, { id: '4', done: true }];
      store.setCollection('todos', newTodos);
      
      expect(doneData.length).toBe(2);
      expect(notDoneData.length).toBe(2);
    });
  });
});
