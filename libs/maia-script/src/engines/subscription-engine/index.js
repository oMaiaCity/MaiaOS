/**
 * SubscriptionEngine Module
 * 
 * Re-exports for backward compatibility.
 * Import from this file to use SubscriptionEngine.
 */

export { SubscriptionEngine } from './subscription.engine.js';
export { subscribeToContext, handleDataUpdate, isSameData } from './data-subscriptions.js';
export {
  collectViewStyleStateSubscriptions,
  collectInterfaceContextSubscriptions,
  executeBatchSubscriptions
} from './config-subscriptions.js';
export {
  handleViewUpdate,
  handleStyleUpdate,
  handleStateUpdate,
  handleInterfaceUpdate,
  handleContextUpdate
} from './update-handlers.js';
