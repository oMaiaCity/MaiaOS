/**
 * Header Composite Factory
 * Standard page header with flex layout
 */

import type { CompositeNode } from '$lib/compositor/view/types';

export interface HeaderParams {
  classes?: string;
}

export function createHeaderComposite(params: HeaderParams = {}): CompositeNode {
  const defaultClasses = '!overflow-visible px-2 @xs:px-3 @sm:px-4 @md:px-6 py-3 @xs:py-3 @sm:py-4 border-b border-slate-200 flex-col items-center gap-3 h-auto'; // Override overflow-hidden, add h-auto
  
  return {
    container: {
      layout: 'flex',
      class: params.classes || defaultClasses
    },
    children: [] // Will be populated by child actors (title centered on top, switcher centered below)
  };
}
