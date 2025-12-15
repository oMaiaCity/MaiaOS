/**
 * View Node Registry - Central registry for all view node configs (composites and leaves)
 * Enables ID-based view node resolution for dynamic config swapping
 */

import type { CompositeConfig } from './types'
import type { LeafNode } from './leaf-types'

class ViewNodeRegistryImpl {
	private composites: Map<string, CompositeConfig> = new Map()
	private leaves: Map<string, LeafNode> = new Map()

	/**
	 * Register a composite config by ID
	 */
	registerComposite(composite: CompositeConfig): void {
		if (!composite.id) {
			console.warn('Composite config missing ID, cannot register:', composite)
			return
		}
		this.composites.set(composite.id, composite)
	}

	/**
	 * Register a leaf config by ID
	 */
	registerLeaf(leaf: LeafNode): void {
		if (!leaf.id) {
			console.warn('Leaf config missing ID, cannot register:', leaf)
			return
		}
		this.leaves.set(leaf.id, leaf)
	}

	/**
	 * Register a composite or leaf (auto-detects type)
	 */
	register(node: CompositeConfig | LeafNode): void {
		if ('container' in node && 'children' in node) {
			// It's a CompositeConfig
			this.registerComposite(node as CompositeConfig)
		} else if ('tag' in node) {
			// It's a LeafNode
			this.registerLeaf(node as LeafNode)
		} else {
			console.warn('Unknown node type, cannot register:', node)
		}
	}

	/**
	 * Register multiple composites at once
	 */
	registerAllComposites(composites: CompositeConfig[]): void {
		composites.forEach((composite) => this.registerComposite(composite))
	}

	/**
	 * Register multiple leaves at once
	 */
	registerAllLeaves(leaves: LeafNode[]): void {
		leaves.forEach((leaf) => this.registerLeaf(leaf))
	}

	/**
	 * Register multiple view nodes at once (auto-detects type)
	 */
	registerAll(nodes: (CompositeConfig | LeafNode)[]): void {
		nodes.forEach((node) => this.register(node))
	}

	/**
	 * Get a composite by ID
	 */
	getComposite(id: string): CompositeConfig | undefined {
		return this.composites.get(id)
	}

	/**
	 * Get a leaf by ID
	 */
	getLeaf(id: string): LeafNode | undefined {
		return this.leaves.get(id)
	}

	/**
	 * Get a view node by ID (auto-detects type)
	 * Returns the node if found, or undefined
	 */
	get(id: string): CompositeConfig | LeafNode | undefined {
		return this.composites.get(id) || this.leaves.get(id)
	}

	/**
	 * Check if a composite exists
	 */
	hasComposite(id: string): boolean {
		return this.composites.has(id)
	}

	/**
	 * Check if a leaf exists
	 */
	hasLeaf(id: string): boolean {
		return this.leaves.has(id)
	}

	/**
	 * Check if a view node exists (composite or leaf)
	 */
	has(id: string): boolean {
		return this.composites.has(id) || this.leaves.has(id)
	}

	/**
	 * Get all registered composites
	 */
	getAllComposites(): CompositeConfig[] {
		return Array.from(this.composites.values())
	}

	/**
	 * Get all registered leaves
	 */
	getAllLeaves(): LeafNode[] {
		return Array.from(this.leaves.values())
	}

	/**
	 * Get all registered view nodes
	 */
	getAll(): (CompositeConfig | LeafNode)[] {
		return [...this.getAllComposites(), ...this.getAllLeaves()]
	}
}

// ========== GLOBAL REGISTRY INSTANCE ==========

/**
 * Global view node registry instance
 */
export const viewNodeRegistry = new ViewNodeRegistryImpl()

