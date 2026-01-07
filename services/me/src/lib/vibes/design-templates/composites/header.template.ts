/**
 * Header Composite Template
 * Standard page header with flex layout
 */

import type { CompositeConfig } from '$lib/compositor/view/types';

export interface HeaderParams {
  classes?: string;
}

export function createHeaderComposite(params: HeaderParams = {}): CompositeConfig {
  const defaultClasses = 'px-6 py-4 border-b border-slate-200 flex-row justify-between items-center';
  
  return {
    container: {
      layout: 'flex',
      class: params.classes || defaultClasses
    },
    children: [] // Will be populated by child actors
  };
}
