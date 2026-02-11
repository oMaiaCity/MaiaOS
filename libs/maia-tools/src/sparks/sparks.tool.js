import { createSuccessResult, createErrorResult, createErrorEntry } from '@MaiaOS/operations';

/**
 * Sparks Tool - @sparks
 * Domain-specific tool for managing Sparks (collaborative spaces/groups).
 * Returns OperationResult; kernel.db() throws on failure, we catch and convert.
 */
export default {
  async execute(actor, payload) {
    if (!actor) {
      return createErrorResult([createErrorEntry('structural', '[@sparks] Actor context required')]);
    }

    const os = actor.actorEngine?.os;
    if (!os || !os.db) {
      return createErrorResult([createErrorEntry('structural', '[@sparks] Database engine not available')]);
    }

    try {
      const data = await os.db(payload);
      return createSuccessResult(data);
    } catch (err) {
      return createErrorResult(err.errors ?? [createErrorEntry('structural', err.message || 'Spark operation failed')]);
    }
  }
};
