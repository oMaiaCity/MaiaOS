import type { Skill } from './types';
import { createActorLogger } from '../utilities/logger';

export const updateContextSkill: Skill = {
  metadata: {
    id: '@input/updateContext',
    name: 'Update Actor Context',
    description: 'Generic skill to update any actor context property',
    category: 'context',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: true // Accept any properties
    }
  },
  execute: (actor: any, payload?: unknown) => {
    const logger = createActorLogger(actor);
    
    if (!actor.context) {
      logger.warn('Actor has no context to update');
      return;
    }
    
    const updates = payload as Record<string, unknown> || {};
    logger.log('Updating context with:', updates);
    
    // Update each property in the context
    for (const [key, value] of Object.entries(updates)) {
      if (actor.context.hasOwnProperty(key)) {
        (actor.context as any)[key] = value;
        logger.log(`Updated context.${key} =`, value);
      } else {
        logger.warn(`Property ${key} not found in context, skipping`);
      }
    }
  }
};

export const contextSkills: Record<string, Skill> = {
  '@input/updateContext': updateContextSkill
};
