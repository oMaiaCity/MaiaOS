import { writable, get } from 'svelte/store';

export class StateMachine {
    constructor(config, context = {}) {
        this.config = config;
        this.state = writable({
            value: config.initial,
            context: context,
            matches: (stateValue) => get(this.state).value === stateValue
        });
        this.services = {};
    }

    subscribe(run) {
        return this.state.subscribe(run);
    }

    send(event, payload) {
        // console.log(`FSM: Received event '${event}' in state '${get(this.state).value}'`);
        const currentStateVal = get(this.state).value;
        const currentStateConfig = this.config.states[currentStateVal];

        if (!currentStateConfig || !currentStateConfig.on || !currentStateConfig.on[event]) {
            console.warn(`Event '${event}' not handled in state '${currentStateVal}'`);
            return;
        }

        const nextStateVal = currentStateConfig.on[event];

        // Check if it's a string (simple transition) or object (complex transition)
        const target = typeof nextStateVal === 'string' ? nextStateVal : nextStateVal.target;
        const actions = typeof nextStateVal === 'object' ? nextStateVal.actions : undefined;

        this.transition(target, actions, payload);
    }

    transition(nextStateVal, actions, payload) {
        const previousState = get(this.state).value;

        // Execute actions if any (before state change or after? usually during)
        if (actions) {
            // Update context based on payload if action is a function
            if (Array.isArray(actions)) {
                actions.forEach(action => action(get(this.state).context, payload));
            } else if (typeof actions === 'function') {
                actions(get(this.state).context, payload);
            }
        }

        // Update state
        this.state.update(s => ({ ...s, value: nextStateVal }));

        // Handle 'invoke' (services)
        const nextStateConfig = this.config.states[nextStateVal];
        if (nextStateConfig && nextStateConfig.invoke) {
            this.runService(nextStateConfig.invoke, nextStateVal);
        }
    }

    async runService(serviceName, stateVal) {
        // In a real implementation, services would be looked up from a registry or passed in
        // For now, we assume services are passed in config or globally available
        // We actually expect 'invoke' to be a function in this JS config implementation
        // console.log(`Invoking service in state: ${stateVal}`);
        
        if (typeof serviceName === 'function') {
            const context = get(this.state).context;
            try {
                await serviceName(context);
                this.send('DONE');
            } catch (error) {
                console.error(error);
                this.send('ERROR');
            }
        }
    }
}

export const createMachine = (config, context) => new StateMachine(config, context);
