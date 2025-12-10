/**
 * Vibes Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from "../../compositor/types";
import { vibesStateMachine } from "./stateMachine";
import { vibesView } from "./views";

export const vibesVibeConfig: VibeConfig = {
  stateMachine: vibesStateMachine,
  view: vibesView,
};
