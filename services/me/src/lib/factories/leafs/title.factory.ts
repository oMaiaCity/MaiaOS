/**
 * Title Leaf Factory
 * Standard title/heading element
 */

import type { LeafNode } from '$lib/compositor/view/leaf-types';

export interface TitleParams {
  text: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  classes?: string;
}

export function createTitleLeaf(params: TitleParams): LeafNode {
  const defaultClasses = 'text-lg font-semibold text-slate-700 m-0';
  
  return {
    tag: params.tag || 'h2',
    classes: params.classes || defaultClasses,
    elements: [params.text]
  };
}
