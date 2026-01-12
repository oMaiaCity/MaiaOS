/**
 * Context Tool Module - Builtin state mutation operations
 * Always loaded - provides fundamental UI/state operations
 * 
 * Consolidates:
 * - Context updates (from context-skills.ts)
 * - UI operations (from entity-skills.ts)
 * - Actor swapping (from context-skills.ts)
 * - Navigation (from entity-skills.ts)
 * 
 * All tools use @context/* namespace for consistency
 */

import type { ToolModule } from './module-types'
import type { Tool } from './types'
import { createActorLogger } from '$lib/utils/logger'

// ========== CONTEXT UPDATE TOOLS ==========

const updateTool: Tool = {
  metadata: {
    id: '@context/update',
    name: 'Update Actor Context',
    description: 'Generic tool to update any actor context property',
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
    
    // Create new context object with updates (immutable pattern)
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
    
    // Use Jazz $jazz.set() for proper reactivity
    if (hasChanges) {
      actor.$jazz.set('context', updatedContext);
      logger.log('Context updated via Jazz $jazz.set()');
    }
  }
};

const swapActorsTool: Tool = {
  metadata: {
    id: '@context/swapActors',
    name: 'Swap Actors',
    description: 'Swaps actor IDs in a container\'s children array - fully generic view/content switching',
    category: 'context',
    parameters: {
      type: 'object',
      properties: {
        targetActorId: { type: 'string', description: 'Direct: The actor ID to insert' },
        viewMode: { type: 'string', description: 'Mapped: viewMode to look up in context.viewActors' },
        targetActor: { type: 'string', description: 'Key in dependencies to find target actor with children' },
      },
    },
  },
  execute: (actor: any, payload?: unknown, accountCoState?: any) => {
    const logger = createActorLogger(actor);
    
    const payloadObj = payload as { targetActorId?: string; viewMode?: string; targetActor?: string };
    let targetActorId = payloadObj?.targetActorId;
    const viewMode = payloadObj?.viewMode;
    
    // STEP 1: Update actor's own state (proper actor architecture)
    // If this actor has context.activeView, update it (for view switcher buttons)
    if (viewMode && actor.context && actor.$jazz) {
      const currentContext = actor.context as Record<string, unknown>;
      if ('activeView' in currentContext && (currentContext as any).activeView !== viewMode) {
        const updatedContext = {
          ...currentContext,
          activeView: viewMode,
        };
        actor.$jazz.set('context', updatedContext);
        logger.log(`Updated context.activeView to: ${viewMode}`);
      }
    }
    
    // STEP 2: Check if actor has the viewActors mapping (for actual view swapping)
    const context = actor.context as any;
    const hasViewActors = context?.viewActors && typeof context.viewActors === 'object';
    
    // If this actor doesn't have viewActors, it's just a button actor
    // The event will be forwarded to subscribers (which should have viewActors)
    if (!hasViewActors) {
      // Event forwarded automatically by ActorEngine
      return;
    }
    
    // Update context.viewMode if provided (for subscribers that need it)
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
    
    // If actor doesn't have children, can't swap
    if (!actor.children || !actor.$jazz) {
      logger.warn('Actor missing children or $jazz, cannot swap actors');
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
      // Only warn if we had a viewMode but couldn't resolve it AND the actor has children
      // If actor doesn't have children, the viewMode update was successful and that's the main purpose
      if (viewMode && actor.children) {
        logger.warn('No targetActorId provided or resolved from viewMode');
      }
      // Otherwise, silently return - viewMode update was successful
      return;
    }
    
    // Get current children
    const currentChildren = Array.from(actor.children || []);
    logger.log('Current children:', currentChildren);
    
    // If already showing this actor, do nothing
    if (currentChildren.length === 1 && currentChildren[0] === targetActorId) {
      logger.log(`Already showing actor: ${targetActorId}`);
      return;
    }
    
    // Clear children array and add new actor
    const childrenCount = actor.children.length;
    if (childrenCount > 0) {
      actor.children.$jazz.splice(0, childrenCount);
    }
    actor.children.$jazz.push(targetActorId);
    
    logger.log(`✅ Swapped to actor: ${targetActorId}`);
  }
};

const handleKeyDownTool: Tool = {
  metadata: {
    id: '@context/handleKeyDown',
    name: 'Handle Key Down',
    description: 'Handles keyboard events, specifically Enter key to submit',
    category: 'context',
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
    }
  }
};

// ========== INPUT FIELD TOOLS ==========

const updateInputTool: Tool = {
	metadata: {
		id: '@context/updateInput',
		name: 'Update Input',
		description: 'Update input field value in context (for inline editing)',
		category: 'context',
		parameters: {
			type: 'object',
			properties: {
				field: {
					type: 'string',
					description: 'Field name (stored as context.editing{Field})',
					required: true,
				},
				value: {
					type: 'string',
					description: 'The new value',
					required: true,
				},
			},
			required: ['field', 'value'],
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const logger = createActorLogger(actor);
		const payloadData = payload as { field?: string; value?: string | number | boolean } || {};
		const { field, value } = payloadData;
		
		if (!field) {
			logger.warn('No field provided to updateInput');
			return;
		}
		
		// Store input value in context with "editing{Field}" pattern
		const contextKey = `editing${field.charAt(0).toUpperCase()}${field.slice(1)}`;
		actor.context[contextKey] = value;
		
		await actor.$jazz.waitForSync();
		
		logger.log(`Updated ${contextKey} to:`, value);
	},
}

const clearInputTool: Tool = {
	metadata: {
		id: '@context/clearInput',
		name: 'Clear Input',
		description: 'Clears the input field in actor.context',
		category: 'context',
		parameters: {
			type: 'object',
			properties: {
				fieldPath: {
					type: 'string',
					description: 'Field path in actor.context to clear',
					required: true,
				},
			},
			required: ['fieldPath'],
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const payloadData = (payload as {
			fieldPath?: string
		}) || {}

		const fieldPath = payloadData.fieldPath

		if (!fieldPath) return

		const pathParts = fieldPath.split('.')
		let target: any = actor.context
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part]
		}

		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = ''

		await actor.$jazz.waitForSync()
	},
}

// ========== VISIBILITY TOOLS ==========

const toggleVisibleTool: Tool = {
	metadata: {
		id: '@context/toggleVisible',
		name: 'Toggle Visible',
		description: 'Toggle actor.context.visible flag',
		category: 'context',
		parameters: {
			type: 'object',
			properties: {
				visible: {
					type: 'boolean',
					description: 'Explicit visible value (if not provided, toggles current value)',
					required: false,
				},
			},
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const { visible } = (payload as { visible?: boolean }) || {}
		
		actor.context.visible = visible !== undefined ? visible : !actor.context.visible

		await actor.$jazz.waitForSync()
	},
}

// ========== NAVIGATION TOOLS ==========

const navigateTool: Tool = {
	metadata: {
		id: '@context/navigate',
		name: 'Navigate to Vibe',
		description: 'Navigates to a different vibe by updating browser URL',
		category: 'context',
		parameters: {
			type: 'object',
			properties: {
				targetActorId: {
					type: 'string',
					description: 'The CoValue ID of the target vibe actor to navigate to (direct)',
					required: false,
				},
				vibeName: {
					type: 'string',
					description: 'The name of the vibe to navigate to',
					required: false,
				},
			},
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const { targetActorId, vibeName } = payload as { targetActorId?: string; vibeName?: string };
		
		if (!targetActorId && !vibeName) {
			throw new Error('Either targetActorId or vibeName is required');
		}

		// Use SvelteKit navigation instead of history.pushState
		if (typeof window !== 'undefined') {
			const { goto } = await import('$app/navigation');
			const url = new URL(window.location.href);
			
			if (targetActorId) {
				url.searchParams.set('id', targetActorId);
				url.searchParams.delete('vibe');
			} else if (vibeName) {
				url.searchParams.set('vibe', vibeName);
				url.searchParams.delete('id');
			}
			
			// Use SvelteKit's goto with replaceState to avoid adding to history
			await goto(url.pathname + url.search, { replaceState: true, noScroll: true });
		}
	},
};

// ========== DRAG-AND-DROP TOOLS ==========

const dragStartTool: Tool = {
	metadata: {
		id: '@context/dragStart',
		name: 'Drag Start',
		description: 'Stores drag state in context when drag operation starts',
		category: 'context',
		parameters: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'ID of item being dragged', required: true },
				status: { type: 'string', description: 'Current status of item', required: false },
			},
			required: ['id'],
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const { id, status } = (payload as { id?: string; status?: string }) || {}
		
		if (!id) return
		
		actor.context.draggedTodoId = id
		actor.context.draggedTodoStatus = status
		actor.context.isDragging = true
		
		await actor.$jazz.waitForSync()
	},
}

const dragEndTool: Tool = {
	metadata: {
		id: '@context/dragEnd',
		name: 'Drag End',
		description: 'Clears drag state from context when drag operation ends',
		category: 'context',
		parameters: {},
	},
	execute: async (actor: any, payload?: unknown) => {
		actor.context.draggedTodoId = null
		actor.context.draggedTodoStatus = null
		actor.context.isDragging = false
		
		await actor.$jazz.waitForSync()
	},
}

const dropTool: Tool = {
	metadata: {
		id: '@context/drop',
		name: 'Drop Item',
		description: 'Updates dragged item status on drop (reads ID from context, updates via @core/updateEntity)',
		category: 'context',
		parameters: {
			type: 'object',
			properties: {
				status: { type: 'string', description: 'Target status for dropped item', required: true },
			},
			required: ['status'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const { status: newStatus } = (payload as { status?: string }) || {}
		const draggedTodoId = actor.context?.draggedTodoId
		
		if (!draggedTodoId || !newStatus) return
		
		// Import core module to reuse updateEntity
		const { toolModuleRegistry } = await import('./module-registry')
		const updateEntityTool = toolModuleRegistry.getTool('@core/updateEntity')
		
		if (updateEntityTool) {
			await updateEntityTool.execute(actor, { id: draggedTodoId, status: newStatus }, accountCoState)
		}
		
		// Clear drag state
		actor.context.draggedTodoId = null
		actor.context.draggedTodoStatus = null
		actor.context.isDragging = false
		
		await actor.$jazz.waitForSync()
	},
}

// ========== MODULE EXPORT ==========

export const contextModule: ToolModule = {
	name: 'context',
	version: '1.0.0',
	builtin: true,
	tools: {
		'@context/update': updateTool,
		'@context/swapActors': swapActorsTool,
		'@context/handleKeyDown': handleKeyDownTool,
		'@context/updateInput': updateInputTool,
		'@context/clearInput': clearInputTool,
		'@context/toggleVisible': toggleVisibleTool,
		'@context/navigate': navigateTool,
		'@context/dragStart': dragStartTool,
		'@context/dragEnd': dragEndTool,
		'@context/drop': dropTool,
	},
}

// Auto-register context module (builtin - always loaded)
import { toolModuleRegistry } from './module-registry'
toolModuleRegistry.register(contextModule)
