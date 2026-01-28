export class ReactiveStore {
  constructor(initialValue) {
    this._value = initialValue;
    this._subscribers = new Set();
  }
  
  get value() {
    return this._value;
  }
  
  subscribe(callback, options = {}) {
    this._subscribers.add(callback);
    if (!options.skipInitial) {
      callback(this._value);
    }
    return () => this._subscribers.delete(callback);
  }
  
  _set(newValue) {
    this._value = newValue;
    this._subscribers.forEach(cb => cb(newValue));
  }
}
