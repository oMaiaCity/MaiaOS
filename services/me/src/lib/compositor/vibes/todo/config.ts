/**
 * Todo Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from "../../types";
import { todoStateMachine } from "./stateMachine";
import { todoView } from "./views";

export const todoVibeConfig: VibeConfig = {
  stateMachine: todoStateMachine,
  view: todoView,
};

// @deprecated Use todoVibeConfig instead
export const todoCompositorConfig = todoVibeConfig;

