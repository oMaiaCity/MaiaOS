/**
 * ReactiveStore - Reactive data store pattern (like Svelte stores)
 *
 * Provides a simple, composable reactive data structure that holds a value
 * and notifies subscribers when the value changes.
 *
 * Usage:
 *   const store = new ReactiveStore(initialValue);
 *   const unsubscribe = store.subscribe((value) => {
 *     console.log('Value updated:', value);
 *   });
 *   console.log('Current value:', store.value);
 *   store._set(newValue); // Internal method to update value
 */

export class ReactiveStore {
	constructor(initialValue) {
		this._value = initialValue
		this._subscribers = new Set()
		this._unsubscribe = null // Optional cleanup function set by peer (e.g., MaiaDB)
	}

	/**
	 * Get current value
	 * @returns {any} Current store value
	 */
	get value() {
		return this._value
	}

	/**
	 * Subscribe to value changes
	 * Callback is called immediately with current value, then on every update
	 * Automatically calls _unsubscribe() when the last subscriber unsubscribes
	 * @param {Function} callback - Function called with new value
	 * @param {Object} [options] - Subscription options
	 * @param {boolean} [options.skipInitial=false] - If true, don't call callback immediately with current value
	 * @returns {Function} Unsubscribe function
	 */
	subscribe(callback, options = {}) {
		this._subscribers.add(callback)
		if (!options.skipInitial) {
			callback(this._value) // Call immediately with current value
		}

		// Return unsubscribe function that checks if we should call _unsubscribe()
		return () => {
			this._subscribers.delete(callback)

			// CRITICAL FIX: Auto-call _unsubscribe() when last subscriber unsubscribes
			// This ensures MaiaDB._storeSubscriptions is cleaned up automatically
			// when all actors unsubscribe from a store (e.g., when agent is unloaded)
			if (this._subscribers.size === 0 && this._unsubscribe) {
				this._unsubscribe()
			}
		}
	}

	/**
	 * Internal method to update store value
	 * Notifies all subscribers of the change
	 * @param {any} newValue - New value to set
	 * @private
	 */
	_set(newValue) {
		this._value = newValue
		for (const cb of this._subscribers) cb(newValue)
	}
}
