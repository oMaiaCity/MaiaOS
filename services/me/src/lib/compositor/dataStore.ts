/**
 * Unified Reactive Data Store
 * Single DRY interface for all data management - no distinction between states, context, or data types
 * Fully reactive, generic, and error-prone
 */

import { writable, type Writable } from "svelte/store";

// ========== TYPES ==========

/**
 * Unified Data Interface - Everything is just data
 * No distinction between state, context, todos, etc.
 */
export type Data = Record<string, unknown>;

/**
 * Action function - operates on unified data
 */
export type Action = (data: Data, payload?: unknown) => void;

/**
 * State Machine Config - simplified, unified
 */
export interface StateMachineConfig {
    initial: string;
    states: Record<
        string,
        {
            on?: Record<string, string | { target: string; actions?: string[] }>;
            entry?: string[];
            exit?: string[];
        }
    >;
    data?: Data;
    actions?: Record<string, Action>;
}

/**
 * Unified Data Store - Single reactive interface
 */
export interface DataStore extends Writable<Data> {
    send: (event: string, payload?: unknown) => void;
    update: (updater: (data: Data) => Data) => void;
    reset: () => void;
    getState: () => string;
}

// ========== STATE MACHINE CLASS ==========

class UnifiedDataStore {
    private config: StateMachineConfig;
    private _data: Data;
    private _state: string;
    private subscribers: Set<(data: Data) => void> = new Set();

    constructor(config: StateMachineConfig) {
        this.config = config;
        this._state = config.initial;
        this._data = config.data ? { ...config.data, _state: config.initial } : { _state: config.initial };
    }

    /**
     * Get current data (fully reactive)
     */
    get data(): Data {
        return this._data;
    }

    /**
     * Get current state
     */
    get state(): string {
        return this._state;
    }

    /**
     * Subscribe to data changes
     */
    subscribe(callback: (data: Data) => void): () => void {
        this.subscribers.add(callback);
        callback(this._data);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Send an event
     */
    send(event: string, payload?: unknown): void {
        const currentStateConfig = this.config.states[this._state];

        if (!currentStateConfig?.on?.[event]) {
            console.warn(`Event '${event}' not handled in state '${this._state}'`);
            return;
        }

        // Execute exit actions
        if (currentStateConfig.exit) {
            this.executeActions(currentStateConfig.exit, payload);
        }

        const nextStateConfig = currentStateConfig.on[event];
        const target =
            typeof nextStateConfig === "string" ? nextStateConfig : nextStateConfig.target;
        const actions =
            typeof nextStateConfig === "object" ? nextStateConfig.actions : undefined;

        this.transition(target, actions, payload);
    }

    /**
     * Transition to a new state
     */
    private transition(nextStateVal: string, actions?: string[], payload?: unknown): void {
        // Update state
        this._state = nextStateVal;
        this._data = { ...this._data, _state: nextStateVal };

        // Execute entry actions
        const nextStateConfig = this.config.states[nextStateVal];
        if (nextStateConfig?.entry) {
            this.executeActions(nextStateConfig.entry, payload);
        }

        // Execute transition actions
        if (actions) {
            this.executeActions(actions, payload);
        }

        this.notifySubscribers();
    }

    /**
     * Execute actions on unified data
     */
    private executeActions(actionNames: string[], payload?: unknown): void {
        if (!this.config.actions) return;

        actionNames.forEach((actionName) => {
            const action = this.config.actions![actionName];
            if (action) {
                try {
                    action(this._data, payload);
                    // Create new data object to trigger reactivity
                    this._data = { ...this._data };
                    this.notifySubscribers();
                } catch (error) {
                    console.error(`Error executing action '${actionName}':`, error);
                }
            } else {
                console.warn(`Action '${actionName}' not found`);
            }
        });
    }

    /**
     * Notify subscribers
     */
    private notifySubscribers(): void {
        this.subscribers.forEach((callback) => {
            try {
                callback(this._data);
            } catch (error) {
                console.error("Error in subscriber:", error);
            }
        });
    }

    /**
     * Update data directly
     */
    update(updater: (data: Data) => Data): void {
        this._data = updater(this._data);
        this.notifySubscribers();
    }

    /**
     * Reset to initial state
     */
    reset(): void {
        this._state = this.config.initial;
        this._data = this.config.data
            ? { ...this.config.data, _state: this.config.initial }
            : { _state: this.config.initial };
        this.notifySubscribers();
    }
}

// ========== FACTORY FUNCTION ==========

/**
 * Create unified reactive data store
 */
export function createDataStore(config: StateMachineConfig): DataStore {
    const store = new UnifiedDataStore(config);
    const writableStore = writable(store.data);

    // Subscribe to store changes
    store.subscribe((data) => {
        writableStore.set(data);
    });

    return {
        ...writableStore,
        send: (event: string, payload?: unknown) => {
            store.send(event, payload);
        },
        update: (updater: (data: Data) => Data) => {
            store.update(updater);
        },
        reset: () => {
            store.reset();
        },
        getState: () => store.state,
    };
}

