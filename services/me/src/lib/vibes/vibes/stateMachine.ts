/**
 * Vibes Vibe State Machine Configuration
 * Manages the list of available vibes and selected vibe
 */

import type { StateMachineConfig } from "../../compositor/types";

export const vibesStateMachine: StateMachineConfig = {
  initial: "idle",
  data: {
    availableVibes: [
      {
        id: "todo",
        name: "Todo",
        description: "Task management vibe",
      },
      {
        id: "wallet",
        name: "Wallet",
        description: "Wallet management vibe",
      },
    ],
    selectedVibeId: null as string | null,
  },
  states: {
    idle: {
      on: {
        SELECT_VIBE: {
          target: "idle",
          actions: ["@vibes/selectVibe"],
        },
      },
    },
  },
  actions: {},
};
