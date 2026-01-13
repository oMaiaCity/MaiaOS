/**
 * Context Tools Module - State mutation
 * Inspired by legacy services/me/src/lib/compositor/tools/context.module.ts
 */

export const contextModule = {
  name: 'context',
  version: '1.0.0',
  
  tools: {
    '@context/update': {
      metadata: {
        id: '@context/update',
        name: 'Update Context',
        description: 'Generic context property update',
      },
      execute: (actor, payload) => {
        Object.assign(actor.context, payload);
      }
    },

    '@context/set': {
      metadata: {
        id: '@context/set',
        name: 'Set Context Property',
        description: 'Set single context property',
      },
      execute: (actor, payload) => {
        const { key, value } = payload;
        actor.context[key] = value;
      }
    },
  }
};
