/**
 * Data Explorer - Navigation and state management for data explorer
 * Uses state machine for navigation state management
 */

import { createMachine, StateMachine, commonStates, commonEvents } from './stateMachine.js';

export type NavigationContext =
    | { type: "root" }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { type: "colist"; coValue: any; label: string; parentKey?: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { type: "covalue"; coValue: any; label: string; parentContext?: NavigationContext }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { type: "group"; coValue: any; label: string };

export interface DataExplorerState {
    navigationStack: NavigationContext[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedCoValue: any | null;
}

/**
 * Create a data explorer state machine
 */
export function createDataExplorer(initialContext: NavigationContext = { type: "root" }): StateMachine {
    const initialState: DataExplorerState = {
        navigationStack: [initialContext],
        selectedCoValue: null,
    };

    return createMachine(
        {
            initial: commonStates.idle,
            states: {
                [commonStates.idle]: {
                    on: {
                        [commonEvents.NAVIGATE]: commonStates.navigating,
                    },
                },
                [commonStates.navigating]: {
                    on: {
                        [commonEvents.SUCCESS]: commonStates.idle,
                        [commonEvents.ERROR]: commonStates.error,
                    },
                },
                [commonStates.error]: {
                    on: {
                        [commonEvents.NAVIGATE]: commonStates.navigating,
                    },
                },
            },
        },
        initialState,
    );
}

/**
 * Navigate to a new context
 */
export function navigateTo(
    explorer: StateMachine,
    context: NavigationContext,
): void {
    const currentState = explorer.state.context as DataExplorerState;
    const newStack = [...currentState.navigationStack, context];

    explorer.updateContext(() => ({
        navigationStack: newStack,
        selectedCoValue: context.type !== "root" ? context.coValue : null,
    }));

    explorer.send(commonEvents.NAVIGATE);
    explorer.send(commonEvents.SUCCESS);
}

/**
 * Navigate back
 */
export function navigateBack(explorer: StateMachine): void {
    const currentState = explorer.state.context as DataExplorerState;
    if (currentState.navigationStack.length <= 1) {
        return; // Can't go back from root
    }

    const newStack = currentState.navigationStack.slice(0, -1);
    const previousContext = newStack[newStack.length - 1];

    explorer.updateContext(() => ({
        navigationStack: newStack,
        selectedCoValue: previousContext.type !== "root" ? previousContext.coValue : null,
    }));

    explorer.send(commonEvents.NAVIGATE);
    explorer.send(commonEvents.SUCCESS);
}

/**
 * Select a CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectCoValue(explorer: StateMachine, coValue: any): void {
    explorer.updateContext((context: DataExplorerState) => ({
        ...context,
        selectedCoValue: coValue,
    }));
}

/**
 * Get current navigation context
 */
export function getCurrentContext(explorer: StateMachine): NavigationContext {
    const state = explorer.state.context as DataExplorerState;
    return state.navigationStack[state.navigationStack.length - 1];
}

/**
 * Get navigation stack
 */
export function getNavigationStack(explorer: StateMachine): NavigationContext[] {
    const state = explorer.state.context as DataExplorerState;
    return state.navigationStack;
}

