/**
 * Generic Actor Logger
 * Automatically prefixes logs with [actorRole:actorId] for better debugging
 */

interface ActorLike {
  role?: string;
  $jazz?: { id: string };
}

export function createActorLogger(actor: ActorLike | null | undefined) {
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
 * Create a logger for a specific component/skill with custom prefix
 */
export function createLogger(prefix: string) {
  return {
    log: (...args: any[]) => console.log(`[${prefix}]`, ...args),
    warn: (...args: any[]) => console.warn(`[${prefix}]`, ...args),
    error: (...args: any[]) => console.error(`[${prefix}]`, ...args),
    debug: (...args: any[]) => console.debug(`[${prefix}]`, ...args),
    info: (...args: any[]) => console.info(`[${prefix}]`, ...args),
  };
}
