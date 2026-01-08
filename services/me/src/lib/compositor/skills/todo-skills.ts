/**
 * Todo-specific Skills
 * Handles todo-related operations like creating random todos
 */

import type { Skill } from './types';
import { createEntityGeneric } from '@hominio/db';
import { createActorLogger } from '../utilities/logger';

const createTodoSkill: Skill = {
	metadata: {
		id: '@todo/create',
		name: 'Create Todo',
		description: 'Creates a todo entity with a specific name',
		category: 'todo',
		parameters: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'The name of the todo' },
			},
			required: ['name'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const logger = createActorLogger(actor);
		
		const jazzAccount = accountCoState?.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			logger.error('Jazz account not loaded')
			throw new Error('Jazz account not loaded')
		}

		// Read name from payload (preferred) or fall back to actor's context
		const payloadData = payload as { name?: string } || {};
		let name = payloadData.name;
		
		logger.log('Skill execution started');
		logger.log('Received payload:', payload);
		logger.log('Payload data:', payloadData);
		logger.log('Actor context keys:', actor.context ? Object.keys(actor.context) : 'no context');
		logger.log('Actor context values:', actor.context);
		
		if (!name && actor.context && (actor.context as any).newTodoText) {
			name = (actor.context as any).newTodoText;
			logger.log('Got name from actor.context.newTodoText:', name);
		}
		
		logger.log('Final resolved name:', name);
		
		if (!name || !name.trim()) {
			logger.warn('Todo name is empty, not creating.');
			if (actor.context) {
				(actor.context as any).error = 'Todo name cannot be empty';
			}
			return;
		}

		// Generate random endDate between now and 7 days (legacy logic)
		const now = new Date();
		const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		const randomTime = now.getTime() + Math.random() * (sevenDaysFromNow.getTime() - now.getTime());
		const endDate = new Date(randomTime);

		// Generate random duration between 1 and 8 hours in minutes (legacy logic)
		const duration = Math.floor(Math.random() * 8 * 60) + 60;

		const entityData = {
			name: name.trim(),
			status: 'todo',
			endDate: endDate.toISOString(),
			duration,
		};

		try {
			logger.log('Creating todo with data:', entityData);
			const todo = await createEntityGeneric(jazzAccount, 'Todo', entityData);
			logger.log('⚡ Todo created instantly (local-first):', name, todo.$jazz.id);
			
			// ✅ Clear input and error using Jazz $jazz.set() for proper reactivity
			if (actor.context && actor.$jazz) {
				const currentContext = actor.context as Record<string, unknown>;
				const updatedContext = {
					...currentContext,
					newTodoText: '',
					error: null,
				};
				actor.$jazz.set('context', updatedContext);
				logger.log('Cleared input field via Jazz $jazz.set()');
			}
		} catch (error: any) {
			logger.error('❌ Failed to create todo:', error);
			if (actor.context && actor.$jazz) {
				const currentContext = actor.context as Record<string, unknown>;
				const updatedContext = {
					...currentContext,
					error: `Failed to create todo: ${error.message}`,
				};
				actor.$jazz.set('context', updatedContext);
			}
			throw error;
		}
	},
};

export const todoSkills: Record<string, Skill> = {
	'@todo/create': createTodoSkill,
};
