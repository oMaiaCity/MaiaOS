/**
 * EntityType JSON Schema Definitions
 * 
 * Defines JSON schemas for EntityTypes (Human and Todo)
 * These schemas are used with ensureSchema() to create SchemaDefinition co-values
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const humanEntityTypeSchema: any = {
	type: 'object',
	properties: {
		name: { type: 'string', required: true },
		email: { type: 'string' },
		dateOfBirth: { type: 'date' },
	},
	required: ['name'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const todoEntityTypeSchema: any = {
	type: 'object',
	properties: {
		name: { type: 'string', required: true }, // Todo name content (matches UI schema)
		description: { type: 'string' }, // Optional description
		status: { type: 'string' }, // Plain string field (e.g., 'todo', 'in-progress', 'done')
		endDate: { type: 'string' }, // ISO string date (matches UI schema)
		duration: { type: 'number' }, // Duration in minutes (matches UI schema)
	},
	required: ['name'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const chatMessageEntityTypeSchema: any = {
	type: 'object',
	properties: {
		role: { type: 'string', required: true }, // 'user' | 'assistant' | 'system'
		content: { type: 'string', required: true }, // Message text
		conversationId: { type: 'string' }, // Optional: group messages by conversation
		model: { type: 'string' }, // Optional: model used (e.g., 'minimax/minimax-m2.1')
		timestamp: { type: 'number' }, // Optional: Unix timestamp for sorting
		metadata: { type: 'object' }, // Optional: additional data (JSON)
	},
	required: ['role', 'content'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const actorEntityTypeSchema: any = {
	type: 'object',
	properties: {
		context: { type: 'object', passthrough: true }, // Passthrough object - all actor state lives here
		view: { type: 'o-text' }, // Optional - co.plainText JSON string for collaborative editing
		dependencies: { type: 'object', additionalProperties: { type: 'string' } }, // Record of string to string (name -> CoValue ID)
		inbox: { 
			type: 'o-feed', // Jazz CoFeed type
			items: { 
				type: 'o-map', // ActorMessage is a CoMap
				properties: {
					event: { type: 'string' },
					payload: { type: 'object', passthrough: true },
					timestamp: { type: 'number' },
					from: { type: 'string' }
				}
			}
		},
		subscriptions: { 
			type: 'o-list', // Jazz CoList type
			items: { type: 'string' } 
		},
		children: { 
			type: 'o-list', // Jazz CoList type
			items: { type: 'string' } 
		},
		role: { type: 'string' }, // Optional label for debugging/categorization
	},
	required: ['context', 'dependencies', 'inbox', 'subscriptions', 'children'],
}
