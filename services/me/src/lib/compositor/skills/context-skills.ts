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
      properties: {}, // Accept any properties dynamically
    }
  },
  execute: (actor: any, payload?: unknown) => {
    const logger = createActorLogger(actor);
    
    if (!actor.context || !actor.$jazz) {
      logger.warn('Actor missing context or $jazz, cannot update');
      return;
    }
    
    const updates = payload as Record<string, unknown> || {};
    logger.log('Updating context with:', updates);
    
    // ✅ Create new context object with updates (immutable pattern)
    const currentContext = actor.context as Record<string, unknown>;
    const updatedContext: Record<string, unknown> = { ...currentContext };
    
    // Apply updates to new context object
    let hasChanges = false;
    for (const [key, value] of Object.entries(updates)) {
      if (key in currentContext) {
        updatedContext[key] = value;
        hasChanges = true;
        logger.log(`Will update context.${key} =`, value);
      } else {
        logger.warn(`Property ${key} not found in context, skipping`);
      }
    }
    
    // ✅ Use Jazz $jazz.set() for proper reactivity
    if (hasChanges) {
      actor.$jazz.set('context', updatedContext);
      logger.log('Context updated via Jazz $jazz.set()');
    }
  }
};

/**
 * ✅ UNIFIED ACTOR SWAPPING ARCHITECTURE
 * Generic skill for swapping actor IDs in a container's children array
 * This replaces all visibility-based view switching with proper actor ID swapping
 * Works like the root vibe switcher - fully generic and scalable
 * 
 * Supports two modes:
 * 1. Direct: payload includes targetActorId
 * 2. Mapped: payload includes viewMode, actor.context.viewActors maps viewMode -> actorId
 */
export const swapActorsSkill: Skill = {
  metadata: {
    id: '@view/swapActors',
    name: 'Swap Actors',
    description: 'Swaps actor IDs in a container\'s children array - fully generic view/content switching',
    category: 'view',
    parameters: {
      type: 'object',
      properties: {
        targetActorId: { type: 'string', description: 'Direct: The actor ID to insert' },
        viewMode: { type: 'string', description: 'Mapped: viewMode to look up in context.viewActors' },
      },
    },
  },
  execute: (actor: any, payload?: unknown) => {
    const logger = createActorLogger(actor);
    
    const payloadObj = payload as { targetActorId?: string; viewMode?: string };
    let targetActorId = payloadObj?.targetActorId;
    const viewMode = payloadObj?.viewMode;
    
    // Update context.viewMode if provided (for button styling) - do this even if actor has no children
    if (viewMode && actor.context && actor.$jazz) {
      const currentContext = actor.context as Record<string, unknown>;
      if ((currentContext as any).viewMode !== viewMode) {
        const updatedContext = {
          ...currentContext,
          viewMode,
        };
        actor.$jazz.set('context', updatedContext);
        logger.log(`Updated context.viewMode to: ${viewMode}`);
      }
    }
    
    if (!actor.children || !actor.$jazz) {
      logger.warn('Actor missing children or $jazz, cannot swap actors (but viewMode was updated)');
      return;
    }
    
    // If no direct targetActorId, try to resolve from viewMode mapping
    if (!targetActorId && viewMode && actor.context) {
      const context = actor.context as any;
      if (context.viewActors && context.viewActors[viewMode]) {
        targetActorId = context.viewActors[viewMode];
        logger.log(`Resolved ${viewMode} -> ${targetActorId} from context.viewActors`);
      }
    }
    
    if (!targetActorId) {
      logger.warn('No targetActorId provided or resolved from viewMode');
      return;
    }
    
    // Get current children
    const currentChildren = Array.from(actor.children || []);
    logger.log('Current children:', currentChildren);
    
    // If already showing this actor, do nothing (viewMode already updated above)
    if (currentChildren.length === 1 && currentChildren[0] === targetActorId) {
      logger.log(`Already showing actor: ${targetActorId}`);
      return;
    }
    
    // Clear children array and add new actor
    // Use Jazz CoList API: splice to remove all, then push new actor
    const childrenCount = actor.children.length;
    if (childrenCount > 0) {
      actor.children.$jazz.splice(0, childrenCount);
    }
    actor.children.$jazz.push(targetActorId);
    
    logger.log(`✅ Swapped to actor: ${targetActorId}`);
  }
};

export const handleKeyDownSkill: Skill = {
  metadata: {
    id: '@input/handleKeyDown',
    name: 'Handle Key Down',
    description: 'Handles keyboard events, specifically Enter key to submit',
    category: 'input',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The key that was pressed' },
        shiftKey: { type: 'boolean', description: 'Whether Shift key was pressed' },
        inputText: { type: 'string', description: 'Current input text value' },
      },
    },
  },
  execute: (actor: any, payload?: unknown) => {
    const logger = createActorLogger(actor);
    const payloadData = payload as { key?: string; shiftKey?: boolean; inputText?: string } || {};
    
    // If Enter is pressed (and not Shift+Enter), trigger form submit
    if (payloadData.key === 'Enter' && !payloadData.shiftKey && payloadData.inputText?.trim()) {
      logger.log('Enter key pressed (without Shift), will trigger form submit');
      // The form submit will be handled by the form's submit event
      // This skill is called to prevent default behavior (newline insertion)
      // The actual submit happens via the form's submit event
    }
  }
};

export const contextSkills: Record<string, Skill> = {
  '@input/updateContext': updateContextSkill,
  '@view/swapActors': swapActorsSkill,
  '@input/handleKeyDown': handleKeyDownSkill,
};
