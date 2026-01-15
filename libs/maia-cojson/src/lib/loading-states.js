/**
 * Loading states for CoValue subscriptions
 * 
 * Adapted from jazz-tools loading state pattern.
 * Used to track whether a CoValue is:
 * - LOADING: Being fetched from sync peers
 * - LOADED: Successfully loaded and available
 * - UNAVAILABLE: Failed to load or not accessible
 */

export const CoValueLoadingState = Object.freeze({
  LOADING: "loading",
  LOADED: "loaded",
  UNAVAILABLE: "unavailable",
});
