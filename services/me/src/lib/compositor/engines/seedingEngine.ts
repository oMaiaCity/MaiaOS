/**
 * Central Vibes Seeding Manager
 * Consolidates all actor creation logic into a single, clean flow
 * Manages vibe registration and provides a unified API for seeding
 */

import { createActorEntity, getVibesRegistry } from "@maia/db";
import { Group } from "jazz-tools";
import { createVibesActors } from '$lib/vibes/vibes';
import { createHumansActors } from '$lib/vibes/humans';
import { createTodosActors } from '$lib/vibes/todos';

/**
 * Vibe configuration for actor creation
 */
export interface VibeConfig {
	name: string;
	label: string;
	description: string;
	createActors: (account: any) => Promise<string>;
}

/**
 * Registry of all available vibes
 * Add new vibes here to register them in the system
 */
export const VIBE_REGISTRY: Record<string, VibeConfig> = {
	vibes: {
		name: 'vibes',
		label: 'Vibes',
		description: 'Main vibes dashboard',
		createActors: createVibesActors,
	},
	humans: {
		name: 'humans',
		label: 'Humans',
		description: 'Human contact management',
		createActors: createHumansActors,
	},
	todos: {
		name: 'todos',
		label: 'Todos',
		description: 'Task management and todo lists',
		createActors: createTodosActors,
	},
};

/**
 * Global lock that persists across hot reloads
 * Prevents duplicate actor creation during development
 */
const getGlobalLock = () => {
	if (typeof window === 'undefined') {
		return { seeding: false, vibes: {} as Record<string, boolean> };
	}
	if (!(window as any).__vibesSeederLocks) {
		(window as any).__vibesSeederLocks = { 
			seeding: false, 
			vibes: {} as Record<string, boolean> 
		};
	}
	return (window as any).__vibesSeederLocks;
};

/**
 * Get or create a vibe's root actor
 * @param account - Jazz account instance
 * @param vibeName - Name of the vibe to get/create
 * @returns Root actor ID for the vibe
 * @throws Error if vibe is not registered or creation fails
 */
export async function getOrCreateVibe(account: any, vibeName: string): Promise<string> {
	const locks = getGlobalLock();
	
	// Check if vibe is registered
	const vibeConfig = VIBE_REGISTRY[vibeName];
	if (!vibeConfig) {
		throw new Error(`Vibe "${vibeName}" is not registered. Available vibes: ${Object.keys(VIBE_REGISTRY).join(', ')}`);
	}

	// Acquire vibe-specific lock
	if (locks.vibes[vibeName]) {
		throw new Error(`Already creating ${vibeName} actors`);
	}
	locks.vibes[vibeName] = true;

	try {
		// Get the VibesRegistry entity
		const registry = await getVibesRegistry(account);
		const existingRootId = registry[vibeName];

		// Check if already exists
		if (existingRootId && typeof existingRootId === 'string' && existingRootId.startsWith('co_')) {
			return existingRootId;
		}

		// Create new actors
		const rootActorId = await vibeConfig.createActors(account);

		if (!rootActorId) {
			throw new Error(`Failed to create ${vibeName} actors: No root actor ID returned`);
		}
		return rootActorId;
	} finally {
		locks.vibes[vibeName] = false;
	}
}

/**
 * Seed multiple vibes in parallel
 * @param account - Jazz account instance
 * @param vibeNames - Array of vibe names to seed (default: all registered vibes)
 * @returns Map of vibe names to root actor IDs
 */
export async function seedVibes(
	account: any,
	vibeNames: string[] = Object.keys(VIBE_REGISTRY)
): Promise<Record<string, string>> {
	const locks = getGlobalLock();

	// Acquire global seeding lock
	if (locks.seeding) {
		throw new Error('Seeding already in progress');
	}
	locks.seeding = true;

	try {
		const results: Record<string, string> = {};
		const errors: Record<string, Error> = {};

		// Seed vibes in parallel
		await Promise.allSettled(
			vibeNames.map(async (vibeName) => {
				try {
					const rootId = await getOrCreateVibe(account, vibeName);
					results[vibeName] = rootId;
				} catch (error: any) {
					console.error(`[seeder] ❌ Failed to seed ${vibeName}:`, error);
					errors[vibeName] = error;
				}
			})
		);

		if (Object.keys(errors).length > 0) {
			console.warn('[seeder] Some vibes failed to seed:', errors);
		}

		return results;
	} finally {
		locks.seeding = false;
	}
}

/**
 * Check if a vibe exists in the registry
 * @param account - Jazz account instance
 * @param vibeName - Name of the vibe to check
 * @returns Root actor ID if exists, null otherwise
 */
export async function getVibeIfExists(account: any, vibeName: string): Promise<string | null> {
	try {
		const registry = await getVibesRegistry(account);
		const rootId = registry[vibeName];
		
		if (rootId && typeof rootId === 'string' && rootId.startsWith('co_')) {
			return rootId;
		}
		
		return null;
	} catch (error) {
		console.error(`[seeder] Error checking ${vibeName}:`, error);
		return null;
	}
}

/**
 * List all registered vibes with their metadata
 * @returns Array of vibe configurations
 */
export function listRegisteredVibes(): VibeConfig[] {
	return Object.values(VIBE_REGISTRY);
}

/**
 * Check if a vibe is registered
 * @param vibeName - Name of the vibe to check
 * @returns True if vibe is registered
 */
export function isVibeRegistered(vibeName: string): boolean {
	return vibeName in VIBE_REGISTRY;
}
