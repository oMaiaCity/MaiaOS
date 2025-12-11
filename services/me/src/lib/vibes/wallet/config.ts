/**
 * Wallet Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from "../../compositor/types";
import { walletStateMachine } from "./stateMachine";
import { walletView } from "./views";

export const walletVibeConfig: VibeConfig = {
  stateMachine: walletStateMachine,
  view: walletView,
};



