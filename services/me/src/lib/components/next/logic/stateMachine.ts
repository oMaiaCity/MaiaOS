/**
 * Reusable State Machine - Generic FSM for complex state management
 * Adapted for Svelte 5 with runes
 */

export type StateValue = string;
export type EventType = string;

export interface StateConfig {
    on?: Record<EventType, StateValue | { target: StateValue; actions?: Action[] }>;
    invoke?: (context: any) => Promise<void> | void;
}

export interface StateMachineConfig {
    initial: StateValue;
    states: Record<StateValue, StateConfig>;
}

export type Action = (context: any, payload?: any) => void;

export interface State {
    value: StateValue;
    context: any;
    matches: (stateValue: StateValue) => boolean;
}

export class StateMachine {
    private config: StateMachineConfig;
    private _state: State;
    private subscribers: Set<(state: State) => void> = new Set();

    constructor(config: StateMachineConfig, initialContext: any = {}) {
        this.config = config;
        this._state = {
            value: config.initial,
            context: initialContext,
            matches: (stateValue: StateValue) => this._state.value === stateValue,
        };
    }

    /**
     * Get current state
     */
    get state(): State {
        return this._state;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback: (state: State) => void): () => void {
        this.subscribers.add(callback);
        // Immediately call with current state
        callback(this._state);

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Send an event to the state machine
     */
    send(event: EventType, payload?: any): void {
        const currentStateVal = this._state.value;
        const currentStateConfig = this.config.states[currentStateVal];

        if (!currentStateConfig || !currentStateConfig.on || !currentStateConfig.on[event]) {
            console.warn(`Event '${event}' not handled in state '${currentStateVal}'`);
            return;
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
    private transition(nextStateVal: StateValue, actions?: Action[], payload?: any): void {
        // Execute actions if any
        if (actions) {
            actions.forEach((action) => {
                try {
                    action(this._state.context, payload);
                } catch (error) {
                    console.error("Error executing state machine action:", error);
                }
            });
        }

        // Update state
        this._state = {
            ...this._state,
            value: nextStateVal,
            matches: (stateValue: StateValue) => this._state.value === stateValue,
        };

        // Notify subscribers
        this.notifySubscribers();

        // Handle 'invoke' (services)
        const nextStateConfig = this.config.states[nextStateVal];
        if (nextStateConfig && nextStateConfig.invoke) {
            this.runService(nextStateConfig.invoke, nextStateVal);
        }
    }

    /**
     * Run a service (async operation)
     */
    private async runService(
        service: (context: any) => Promise<void> | void,
        stateVal: StateValue,
    ): Promise<void> {
        try {
            await service(this._state.context);
            this.send("DONE");
        } catch (error) {
            console.error(`Error in service for state '${stateVal}':`, error);
            this.send("ERROR", error);
        }
    }

    /**
     * Notify all subscribers of state change
     */
    private notifySubscribers(): void {
        this.subscribers.forEach((callback) => {
            try {
                callback(this._state);
            } catch (error) {
                console.error("Error in state machine subscriber:", error);
            }
        });
    }

    /**
     * Update context
     */
    updateContext(updater: (context: any) => any): void {
        this._state = {
            ...this._state,
            context: updater(this._state.context),
        };
        this.notifySubscribers();
    }
}

/**
 * Create a new state machine instance
 */
export function createMachine(
    config: StateMachineConfig,
    initialContext: any = {},
): StateMachine {
    return new StateMachine(config, initialContext);
}

/**
 * Common state machine configurations
 */
export const commonStates = {
    idle: "idle",
    loading: "loading",
    loaded: "loaded",
    error: "error",
    navigating: "navigating",
} as const;

export const commonEvents = {
    LOAD: "LOAD",
    SUCCESS: "SUCCESS",
    ERROR: "ERROR",
    NAVIGATE: "NAVIGATE",
    BACK: "BACK",
    DONE: "DONE",
} as const;

