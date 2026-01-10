/**
 * View Factory Functions
 * Exports all factory functions that return CompositeNode/LeafNode
 */

// Composite factories (View-Only)
export { createRootCardComposite } from './composites/rootCard.factory';
export { createHeaderComposite } from './composites/header.factory';
export { createInputSectionComposite } from './composites/inputSection.factory';
export { createViewSwitcherComposite } from './composites/viewSwitcher.factory';
export { createTimelineComposite } from './composites/timeline.factory';
export { createKanbanComposite, defaultKanbanColumns } from './composites/kanban.factory';

// Leaf factories (View-Only)
export { createTitleLeaf } from './leafs/title.factory';
export { createButtonLeaf } from './leafs/button.factory';
export { createBadgeLeaf } from './leafs/badge.factory';
export { createErrorLeaf } from './leafs/error.factory';

// Re-export types
export type { RootCardParams } from './composites/rootCard.factory';
export type { HeaderParams } from './composites/header.factory';
export type { InputSectionParams } from './composites/inputSection.factory';
export type { ViewSwitcherParams } from './composites/viewSwitcher.factory';
export type { TimelineParams } from './composites/timeline.factory';
export type { KanbanParams, KanbanColumn } from './composites/kanban.factory';
export type { TitleParams } from './leafs/title.factory';
export type { ButtonParams } from './leafs/button.factory';
export type { BadgeParams } from './leafs/badge.factory';
export type { ErrorParams } from './leafs/error.factory';
