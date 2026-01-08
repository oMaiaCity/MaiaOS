/**
 * Design Template Factory Functions
 * Exports all template factories that return CompositeNode/LeafNode
 */

// Composite templates (View-Only)
export { createRootCardComposite } from './templates/composites/rootCard.template';
export { createHeaderComposite } from './templates/composites/header.template';
export { createInputSectionComposite } from './templates/composites/inputSection.template';
export { createViewSwitcherComposite } from './templates/composites/viewSwitcher.template';
export { createTimelineComposite } from './templates/composites/timeline.template';
export { createKanbanComposite, defaultKanbanColumns } from './templates/composites/kanban.template';

// Leaf templates (View-Only)
export { createTitleLeaf } from './templates/leafs/title.template';
export { createButtonLeaf } from './templates/leafs/button.template';
export { createBadgeLeaf } from './templates/leafs/badge.template';
export { createErrorLeaf } from './templates/leafs/error.template';

// Re-export types
export type { RootCardParams } from './templates/composites/rootCard.template';
export type { HeaderParams } from './templates/composites/header.template';
export type { InputSectionParams } from './templates/composites/inputSection.template';
export type { ViewSwitcherParams } from './templates/composites/viewSwitcher.template';
export type { TimelineParams } from './templates/composites/timeline.template';
export type { KanbanParams, KanbanColumn } from './templates/composites/kanban.template';
export type { TitleParams } from './templates/leafs/title.template';
export type { ButtonParams } from './templates/leafs/button.template';
export type { BadgeParams } from './templates/leafs/badge.template';
export type { ErrorParams } from './templates/leafs/error.template';
