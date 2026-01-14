/**
 * ReactiveStore - Observable localStorage wrapper for reactive data management
 * 
 * Provides:
 * - localStorage persistence
 * - Observer pattern for reactive updates
 * - JSON-based filtering
 * - Collection-based data organization
 * 
 * Future Migration Path: Replace with Jazz CoMaps/Groups
 */
export class ReactiveStore {
  constructor(storageKey = 'maiaos_data') {
    this.storageKey = storageKey;
    this.observers = new Map(); // schema -> Set<observer>
    this._initializeStorage();
  }

  /**
   * Initialize localStorage with empty data structure if not exists
   */
  _initializeStorage() {
    const existing = localStorage.getItem(this.storageKey);
    if (!existing) {
      localStorage.setItem(this.storageKey, JSON.stringify({}));
    }
  }

  /**
   * Get all data from localStorage
   * @returns {Object} All collections
   */
  _getAllData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[ReactiveStore] Failed to parse localStorage data:', error);
      return {};
    }
  }

  /**
   * Save all data to localStorage
   * @param {Object} data - All collections
   */
  _saveAllData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('[ReactiveStore] Failed to save to localStorage:', error);
      throw error;
    }
  }

  /**
   * Get a collection from localStorage
   * @param {string} schema - Collection name (e.g., 'todos')
   * @returns {Array} Collection data (empty array if not exists)
   */
  getCollection(schema) {
    const allData = this._getAllData();
    return allData[schema] || [];
  }

  /**
   * Set a collection in localStorage and notify observers
   * @param {string} schema - Collection name
   * @param {Array} data - Collection data
   */
  setCollection(schema, data) {
    const allData = this._getAllData();
    allData[schema] = data;
    this._saveAllData(allData);
    this.notify(schema);
  }

  /**
   * Subscribe to collection changes
   * @param {string} schema - Collection name
   * @param {Object|null} filter - Optional filter config { field, op, value }
   * @param {Function} callback - Called when collection changes (data) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(schema, filter, callback) {
    if (!this.observers.has(schema)) {
      this.observers.set(schema, new Set());
    }

    const observer = { filter, callback };
    this.observers.get(schema).add(observer);

    // Immediately call callback with current data
    const data = this.query(schema, filter);
    callback(data);

    // Return unsubscribe function
    return () => {
      const observers = this.observers.get(schema);
      if (observers) {
        observers.delete(observer);
        if (observers.size === 0) {
          this.observers.delete(schema);
        }
      }
    };
  }

  /**
   * Notify all observers of a schema
   * @param {string} schema - Collection name
   */
  notify(schema) {
    const observers = this.observers.get(schema);
    if (!observers) return;

    observers.forEach(observer => {
      const data = this.query(schema, observer.filter);
      observer.callback(data);
    });
  }

  /**
   * Query collection with optional filter
   * @param {string} schema - Collection name
   * @param {Object|null} filter - Filter config { field, op, value }
   * @returns {Array} Filtered results
   */
  query(schema, filter) {
    const collection = this.getCollection(schema);
    
    if (!filter) {
      return collection;
    }

    return this._applyFilter(collection, filter);
  }

  /**
   * Apply filter to collection
   * @param {Array} collection - Data to filter
   * @param {Object} filter - Filter config { field, op, value }
   * @returns {Array} Filtered results
   */
  _applyFilter(collection, filter) {
    const { field, op, value } = filter;

    switch (op) {
      case 'eq':
        return collection.filter(item => item[field] === value);
      
      case 'ne':
        return collection.filter(item => item[field] !== value);
      
      case 'gt':
        return collection.filter(item => item[field] > value);
      
      case 'lt':
        return collection.filter(item => item[field] < value);
      
      case 'gte':
        return collection.filter(item => item[field] >= value);
      
      case 'lte':
        return collection.filter(item => item[field] <= value);
      
      case 'in':
        return collection.filter(item => 
          Array.isArray(value) && value.includes(item[field])
        );
      
      case 'contains':
        return collection.filter(item => 
          typeof item[field] === 'string' && 
          item[field].includes(value)
        );
      
      default:
        console.warn(`[ReactiveStore] Unknown filter operator: ${op}`);
        return collection;
    }
  }

  /**
   * Clear all data (useful for testing)
   */
  clear() {
    localStorage.removeItem(this.storageKey);
    this._initializeStorage();
    
    // Notify all observers that their collections are now empty
    this.observers.forEach((observers, schema) => {
      observers.forEach(observer => observer.callback([]));
    });
  }

  /**
   * Get all observers (useful for debugging)
   * @returns {Map} Map of schema -> Set<observer>
   */
  getObservers() {
    return this.observers;
  }
}
