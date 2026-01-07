/**
 * Design Templates - Template Factory Functions
 * All actor templates for reusable UI components
 */

// Leaf Templates
export { createTitleActor, type TitleParams } from './leaf/title.template';
export { createButtonActor, type ButtonParams } from './leaf/button.template';
export { createDeleteButtonActor, type DeleteButtonParams } from './leaf/deleteButton.template';
export { createTextActor, type TextParams } from './leaf/text.template';

// Composite Templates
export { createHeaderActor, type HeaderParams } from './composite/header.template';
export { createTitleContainerActor, type TitleContainerParams } from './composite/titleContainer.template';
export { createListContainerActor, type ListContainerParams } from './composite/listContainer.template';
export { createRootCardActor, type RootCardParams } from './composite/rootCard.template';
export { createItemCardActor, type ItemCardParams } from './composite/itemCard.template';
export { createVibeCardActor, type VibeCardParams } from './composite/vibeCard.template';
