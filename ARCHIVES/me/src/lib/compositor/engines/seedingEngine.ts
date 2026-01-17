/**
 * Central Vibes Seeding Manager
 * Consolidates all actor creation logic into a single, clean flow
 * Manages vibe registration and provides a unified API for seeding
 */

import { createActorEntity, Vibe } from "@maia/db";
import { Group } from "jazz-tools";
import { createMeActors } from '$lib/vibes/me';
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
	me: {
		name: 'me',
		label: 'Me',
		description: 'Personal dashboard and launcher for all vibes',
		createActors: createMeActors,
	},
	humans: {
		name: 'humans',
		label: 'Human Management',
		description: 'Manage contacts, profiles, and human relationships',
		createActors: createHumansActors,
	},
	todos: {
		name: 'todos',
		label: 'Task Management',
		description: 'Create and manage todos with list, timeline, and kanban views',
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
 * Get vibes list from approot
 */
async function getVibesList(account: any): Promise<any> {
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: { vibes: true } },
	});
	
	if (!loadedAccount.root?.vibes) {
		throw new Error('Vibes list not found - run account migration first');
	}
	
	return loadedAccount.root.vibes;
}

/**
 * Find a vibe manifest by name
 */
async function findVibeManifest(account: any, vibeName: string): Promise<any | null> {
	const vibesList = await getVibesList(account);
	
	for (const vibe of vibesList) {
		if (vibe?.$isLoaded && vibe.name === vibeName) {
			return vibe;
		}
	}
	
	return null;
}

/**
 * Create or update a vibe manifest
 */
async function upsertVibeManifest(
	account: any,
	vibeConfig: VibeConfig,
	rootActorId: string
): Promise<void> {
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: { vibes: true } },
	});
	
	const root = loadedAccount.root;
	const vibesList = root.vibes;
	
	if (!vibesList) {
		throw new Error('Vibes list not found');
	}
	
	// Check if manifest already exists
	const existingManifest = await findVibeManifest(account, vibeConfig.name);
	
	if (existingManifest) {
		// Update existing manifest
		existingManifest.$jazz.set('title', vibeConfig.label);
		existingManifest.$jazz.set('description', vibeConfig.description);
		existingManifest.$jazz.set('actor', rootActorId);
	} else {
		// Create new manifest (import Vibe schema)
		const vibesOwner = (vibesList as any).$jazz?.owner;
		
		const manifest = Vibe.create({
			name: vibeConfig.name,
			title: vibeConfig.label,
			description: vibeConfig.description,
			actor: rootActorId,
		}, vibesOwner);
		
		// Add to vibes list
		vibesList.$jazz.push(manifest);
	}
	
	// If this is the "me" vibe, set it as the genesis (entry point)
	if (vibeConfig.name === 'me') {
		root.$jazz.set('genesis', rootActorId);
	}
}

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
		// Check if vibe manifest exists
		const existingManifest = await findVibeManifest(account, vibeName);
		
		if (existingManifest?.actor) {
			return existingManifest.actor;
		}

		// Create new actors
		const rootActorId = await vibeConfig.createActors(account);

		if (!rootActorId) {
			throw new Error(`Failed to create ${vibeName} actors: No root actor ID returned`);
		}
		
		// Register in vibes list with metadata
		await upsertVibeManifest(account, vibeConfig, rootActorId);
		
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
		const manifest = await findVibeManifest(account, vibeName);
		return manifest?.actor || null;
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

/**
 * Get all vibe manifests with optional filtering
 */
export async function getAllVibes(
	account: any,
	options?: {
		search?: string;
	}
): Promise<any[]> {
	const vibesList = await getVibesList(account);
	let manifests = Array.from(vibesList).filter(v => v?.$isLoaded);
	
	if (options?.search) {
		const query = options.search.toLowerCase();
		manifests = manifests.filter(v =>
			v.name?.toLowerCase().includes(query) ||
			v.title?.toLowerCase().includes(query) ||
			v.description?.toLowerCase().includes(query)
		);
	}
	
	return manifests;
}

/**
 * Get genesis (entry point) vibe actor ID
 */
export async function getGenesisVibe(account: any): Promise<string | null> {
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: { genesis: true } },
	});
	
	return loadedAccount.root?.genesis || null;
}
