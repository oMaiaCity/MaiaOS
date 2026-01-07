/**
 * Button Leaf Template
 * Standard button with event handling
 */

import type { LeafNode } from '$lib/compositor/view/leaf-types';

export interface ButtonParams {
  text: string;
  event: string;
  payload?: any;
  variant?: 'primary' | 'secondary' | 'danger';
  classes?: string;
}

export function createButtonLeaf(params: ButtonParams): LeafNode {
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };
  
  const baseClasses = 'px-4 py-2 rounded-lg transition-colors cursor-pointer';
  const variantClass = variantClasses[params.variant || 'primary'];
  const finalClasses = params.classes || `${baseClasses} ${variantClass}`;
  
  return {
    tag: 'button',
    attributes: { type: 'button' },
    classes: finalClasses,
    events: {
      click: {
        event: params.event,
        payload: params.payload
      }
    },
    elements: [params.text]
  };
}
