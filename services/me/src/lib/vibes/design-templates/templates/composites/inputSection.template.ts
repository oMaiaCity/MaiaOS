/**
 * Input Section Composite Template
 * Reusable input section with form, input field, submit button, and error message
 * Ported from design-system.inputSection schema
 */

import type { CompositeNode } from '$lib/compositor/view/types';

export interface InputSectionParams {
  valuePath: string;
  inputEvent: string;
  submitEvent: string;
  submitPayload?: string;
  inputName?: string;
  placeholder?: string;
  buttonText?: string;
  buttonVisible?: string;
  buttonDisabled?: string;
  errorVisible?: string;
  errorText?: string;
}

export function createInputSectionComposite(params: InputSectionParams): CompositeNode {
  return {
    container: {
      layout: 'content',
      class: 'bg-slate-50 p-4 shrink-0',
    },
    children: [
      {
        slot: 'input.value',
        composite: {
          container: {
            layout: 'flex',
            tag: 'form',
            class: 'flex flex-col @sm:flex-row gap-2 @xs:gap-2 @sm:gap-3 items-stretch @sm:items-center',
          },
          events: {
            submit: {
              event: params.submitEvent,
              payload: params.submitPayload || {},
            },
          },
          children: [
            {
              slot: 'input',
              leaf: {
                tag: 'input',
                attributes: {
                  type: 'text',
                  name: params.inputName || 'new-input',
                  placeholder: params.placeholder || 'Enter text...',
                  autocomplete: 'off',
                },
                classes: 'flex-1 px-3 py-2.5 @xs:px-4 @xs:py-3 @sm:px-5 @sm:py-3.5 rounded-xl @sm:rounded-2xl bg-slate-100 border border-slate-200 shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:border-slate-400 transition-all text-xs @xs:text-sm @sm:text-base text-slate-900 placeholder:text-slate-400 min-h-[44px]',
                bindings: { value: params.valuePath },
                events: {
                  input: {
                    event: params.inputEvent || '@input/updateContext',
                  },
                },
              },
            },
            {
              slot: 'button',
              leaf: {
                tag: 'button',
                attributes: { type: 'submit' },
                classes: 'px-5 py-2.5 @xs:px-6 @xs:py-3 @sm:px-7 @sm:py-3.5 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-xs @xs:text-sm @sm:text-base disabled:opacity-60 disabled:cursor-not-allowed shrink-0 min-h-[44px]',
                bindings: {
                  visible: params.buttonVisible || 'true',
                  disabled: params.buttonDisabled,
                },
                elements: [params.buttonText || 'Add'],
              },
            },
          ],
        },
      },
      {
        slot: 'error',
        leaf: {
          tag: 'div',
          classes: 'mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200/60 shadow-[0_2px_8px_rgba(239,68,68,0.1)] text-red-800 text-sm flex items-center justify-between gap-3 h-auto',
          bindings: {
            visible: params.errorVisible || 'data.view.error',
          },
          elements: [
            {
              tag: 'div',
              classes: 'flex items-center gap-2 flex-1',
              elements: [
                {
                  tag: 'svg',
                  attributes: {
                    class: 'w-5 h-5 text-red-600 shrink-0',
                    fill: 'none',
                    viewBox: '0 0 24 24',
                    stroke: 'currentColor',
                  },
                  elements: [
                    {
                      tag: 'path',
                      attributes: {
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        'stroke-width': '2',
                        d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                      },
                    },
                  ],
                },
                {
                  tag: 'span',
                  classes: 'font-medium',
                  bindings: { text: params.errorText || 'data.view.error' },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}
