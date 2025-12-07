/**
 * CoValue Loader - Standardized CoValue loading with state management
 * Uses state machine for loading state coordination
 */

import { createMachine, StateMachine, commonStates, commonEvents } from './stateMachine.js';

/**
 * Ensure a CoValue is loaded
 * Returns a promise that resolves when the CoValue is loaded
 */
export async function ensureLoaded(coValue: any): Promise<void> {
  if (!coValue) {
    throw new Error("CoValue is null or undefined");
  }

  if (coValue.$isLoaded) {
    return;
  }

  if (!coValue.$jazz?.ensureLoaded) {
    throw new Error("CoValue does not have ensureLoaded method");
  }

  try {
    await coValue.$jazz.ensureLoaded();
  } catch (error) {
    console.error("Error loading CoValue:", error);
    throw error;
  }
}

/**
 * Create a loading state machine for a CoValue
 */
export function createCoValueLoader(coValue: any): StateMachine {
  return createMachine(
    {
      initial: coValue?.$isLoaded ? commonStates.loaded : commonStates.idle,
      states: {
        [commonStates.idle]: {
          on: {
            [commonEvents.LOAD]: commonStates.loading,
          },
        },
        [commonStates.loading]: {
          invoke: async (context) => {
            await ensureLoaded(context.coValue);
          },
          on: {
            [commonEvents.DONE]: commonStates.loaded,
            [commonEvents.ERROR]: commonStates.error,
          },
        },
        [commonStates.loaded]: {},
        [commonStates.error]: {
          on: {
            [commonEvents.LOAD]: commonStates.loading,
          },
        },
      },
    },
    { coValue },
  );
}

/**
 * Load multiple CoValues in parallel
 */
export async function ensureLoadedMultiple(coValues: any[]): Promise<void> {
  await Promise.all(coValues.map((coValue) => ensureLoaded(coValue)));
}

