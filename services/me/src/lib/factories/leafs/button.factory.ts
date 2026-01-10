/**
 * Button Leaf Factory
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
    primary: 'bg-[#001a42] border-[#001a42] text-[#e6ecf7] hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] shadow-button-primary',
    secondary: 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50',
    danger: 'bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600'
  };
  
  const baseClasses = 'px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 border rounded-full transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm shrink-0';
  const variantClass = variantClasses[params.variant || 'primary'];
  const finalClasses = params.classes || `${baseClasses} ${variantClass}`;
  
  return {
    tag: 'button',
    attributes: { type: 'button' },
    classes: finalClasses,
    events: {
      click: {
        event: params.event,
        payload: params.payload || {}
      }
    },
    elements: [params.text]
  };
}
