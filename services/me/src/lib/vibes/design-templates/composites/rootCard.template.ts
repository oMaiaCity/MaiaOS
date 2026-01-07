/**
 * Root Card Composite Template
 * Matches legacy design-system/schemas/rootCard.schema.ts
 * Creates a nested structure: outer container + inner card
 */

import type { CompositeConfig } from '$lib/compositor/view/types';

export interface RootCardParams {
  cardLayout?: 'grid' | 'flex';
  cardClasses?: string;
}

export function createRootCardComposite(params: RootCardParams = {}): CompositeConfig {
  // Combine outer container + card styling into single container
  // This works better with ID-based actor children
  const layout = params.cardLayout || 'flex';
  const baseCardClasses = 'card p-2 @xs:p-3 @sm:p-4 @md:p-6';
  const customClasses = params.cardClasses || '';
  
  // Build final class string: max-width + card styling + custom classes
  const finalClasses = `max-w-6xl mx-auto ${baseCardClasses} ${customClasses}`.trim();
  
  return {
    container: {
      layout,
      class: finalClasses
    },
    children: [] // Child actors will be rendered via childActors prop
  };
}
