/**
 * View Node Registry - Central registry for all view node configs (composites and leaves)
 * Enables ID-based view node resolution for dynamic config swapping
 */

import type { CompositeNode, LeafNode } from '$lib/utils/types'

class ViewNodeRegistryImpl {
	private composites: Map<string, CompositeNode> = new Map()
	private leaves: Map<string, LeafNode> = new Map()

	/**
	 * Register a composite config by ID
	 */
	registerComposite(composite: CompositeNode): void {
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
	register(node: CompositeNode | LeafNode): void {
		const hasContainer = 'container' in node
		const hasChildren = 'children' in node
		const hasSchema = '@schema' in node
		const hasTag = 'tag' in node
		const nodeId = (node as CompositeConfig | LeafNode).id || ''
		
		// Check if it's a composite:
		// - Has container property (regular composite)
		// - OR has @schema AND children property (composite schema instance)
		// - OR has @schema AND ID contains ".composite." (composite schema instance)
		// - OR ID contains ".composite." (fallback for schema instances)
		const isCompositeById = nodeId.includes('.composite.')
		const isLeafById = nodeId.includes('.leaf.')
		
		if (hasContainer || (hasSchema && (hasChildren || isCompositeById)) || isCompositeById) {
			// It's a CompositeNode (either regular or schema instance)
			this.registerComposite(node as CompositeNode)
		} else if (hasTag || (hasSchema && isLeafById) || isLeafById) {
			// It's a LeafNode (either regular or schema instance)
			this.registerLeaf(node as LeafNode)
		} else {
			console.warn('Unknown node type, cannot register:', node)
		}
	}

	/**
	 * Register multiple composites at once
	 */
	registerAllComposites(composites: CompositeNode[]): void {
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
	registerAll(nodes: (CompositeNode | LeafNode)[]): void {
		nodes.forEach((node) => this.register(node))
	}

	/**
	 * Get a composite by ID
	 */
	getComposite(id: string): CompositeNode | undefined {
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
	get(id: string): CompositeNode | LeafNode | undefined {
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
	getAllComposites(): CompositeNode[] {
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
	getAll(): (CompositeNode | LeafNode)[] {
		return [...this.getAllComposites(), ...this.getAllLeaves()]
	}
}

// ========== GLOBAL REGISTRY INSTANCE ==========

/**
 * Global view node registry instance
 */
export const viewNodeRegistry = new ViewNodeRegistryImpl()

