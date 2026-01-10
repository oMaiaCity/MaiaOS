/**
 * Badge Leaf Factory
 * Reusable status badge with color variants
 */

import type { LeafNode } from '$lib/compositor/view/types';

export interface BadgeParams {
  textPath: string;
  variant?: 'done' | 'in-progress' | 'todo' | 'default';
  /** Optional dynamic color expression (overrides variant) */
  colorExpression?: string;
}

export function createBadgeLeaf(params: BadgeParams): LeafNode {
  const baseClasses = 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0';
  
  // If dynamic color expression provided, use base classes only (colors will be bound)
  // Otherwise, use static variant colors
  if (params.colorExpression) {
    return {
      tag: 'span',
      classes: baseClasses,
      bindings: {
        text: params.textPath,
        classes: params.colorExpression,
      },
    };
  }
  
  // Variant-based colors (static)
  const variantClasses: Record<string, string> = {
    done: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    todo: 'bg-slate-100 text-slate-700',
    default: 'bg-gray-100 text-gray-700',
  };
  
  const variantClass = variantClasses[params.variant || 'default'];
  
  return {
    tag: 'span',
    classes: `${baseClasses} ${variantClass}`,
    bindings: {
      text: params.textPath,
    },
  };
}
