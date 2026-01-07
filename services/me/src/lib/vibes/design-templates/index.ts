/**
 * Design Template Factory Functions
 * Exports all template factories that return CompositeConfig/LeafNode
 */

// Composite templates
export { createRootCardComposite } from './composites/rootCard.template';
export { createHeaderComposite } from './composites/header.template';

// Leaf templates
export { createTitleLeaf } from './leafs/title.template';
export { createButtonLeaf } from './leafs/button.template';

// Re-export types
export type { RootCardParams } from './composites/rootCard.template';
export type { HeaderParams } from './composites/header.template';
export type { TitleParams } from './leafs/title.template';
export type { ButtonParams } from './leafs/button.template';
