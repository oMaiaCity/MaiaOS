/**
 * Generic Actor Logger
 * Automatically prefixes logs with [actorRole:actorId] for better debugging
 */

// Global logging switch - set to false to disable all debug/info/log output
// Warnings and errors are always shown regardless of this setting
const LOGGING_ENABLED = false;

// No-op function that does absolutely nothing (for when logging is disabled)
const noop = (..._args: any[]) => {
  // Explicitly do nothing - this prevents any logging when disabled
};

interface ActorLike {
  role?: string;
  $jazz?: { id: string };
}

export function createActorLogger(actor: ActorLike | null | undefined) {
  // Evaluate LOGGING_ENABLED at runtime to ensure it's checked fresh each time
  if (!LOGGING_ENABLED) {
    return {
      log: noop,
      warn: (...args: any[]) => console.warn(`[${actor?.role || 'unknown'}:${actor?.$jazz?.id?.slice(3, 10) || 'unknown'}...]`, ...args),
      error: (...args: any[]) => console.error(`[${actor?.role || 'unknown'}:${actor?.$jazz?.id?.slice(3, 10) || 'unknown'}...]`, ...args),
      debug: noop,
      info: noop,
    };
  }

  const actorId = actor?.$jazz?.id || 'unknown';
  const actorRole = actor?.role || 'unknown';
  const prefix = `[${actorRole}:${actorId.slice(3, 10)}...]`;

  return {
    log: (...args: any[]) => console.log(prefix, ...args),
    warn: (...args: any[]) => console.warn(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
    debug: (...args: any[]) => console.debug(prefix, ...args),
    info: (...args: any[]) => console.info(prefix, ...args),
  };
}

/**
 * Create a logger for a specific component/tool with custom prefix
 */
export function createLogger(prefix: string) {
  // Evaluate LOGGING_ENABLED at runtime to ensure it's checked fresh each time
  if (!LOGGING_ENABLED) {
    return {
      log: noop,
      warn: (...args: any[]) => console.warn(`[${prefix}]`, ...args),
      error: (...args: any[]) => console.error(`[${prefix}]`, ...args),
      debug: noop,
      info: noop,
    };
  }

  return {
    log: (...args: any[]) => console.log(`[${prefix}]`, ...args),
    warn: (...args: any[]) => console.warn(`[${prefix}]`, ...args),
    error: (...args: any[]) => console.error(`[${prefix}]`, ...args),
    debug: (...args: any[]) => console.debug(`[${prefix}]`, ...args),
    info: (...args: any[]) => console.info(`[${prefix}]`, ...args),
  };
}
