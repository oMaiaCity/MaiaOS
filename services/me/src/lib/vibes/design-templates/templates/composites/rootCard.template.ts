/**
 * Root Card Composite Template
 * Single actor with nested div structure:
 * - Outer div: centering wrapper (max-w, mx-auto, padding)
 * - Inner div: card styling (card class, padding, grid layout)
 * Child actors render inside inner div
 */

import type { CompositeNode } from '$lib/compositor/view/types';

export interface RootCardParams {
  cardLayout?: 'grid' | 'flex';
  cardClasses?: string;
}

export function createRootCardComposite(params: RootCardParams = {}): CompositeNode {
  const cardLayout = params.cardLayout || 'grid';
  const defaultCardClasses = 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 grid-cols-1 grid-rows-[auto_auto_1fr]';
  const cardClasses = params.cardClasses || defaultCardClasses;
  
  return {
    // Outer container: centering wrapper
    container: {
      layout: 'grid',
      class: 'max-w-6xl mx-auto grid-cols-1 p-2 @xs:p-3 @sm:p-4 @md:p-6 mb-20'
    },
    // Inner div: card styling
    elements: [
      {
        tag: 'div',
        classes: `${cardClasses} ${cardLayout === 'flex' ? 'flex flex-col' : ''}`,
        slot: 'children' // Child actors render HERE
      }
    ]
  };
}
