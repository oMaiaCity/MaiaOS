/**
 * Simplified Layout Vibe Root - Using Leaf Nodes Only
 * Bypasses semantic layouts to test basic rendering
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import {
    tabButtonGrid,
    tabButtonGridActive,
    tabButtonList,
    tabButtonListActive,
    tabButtonRow,
    tabButtonRowActive,
} from '../leafs/tabButtons'

export const rootComposite: CompositeConfig = {
    container: {
        layout: 'flex',
        class: 'max-w-6xl mx-auto flex-col p-6',
    },
    children: [
        {
            slot: 'cardContainer',
            composite: {
                container: {
                    layout: 'flex',
                    class: 'card p-6 flex-grow flex-shrink flex-basis-0 min-h-0 flex-col',
                },
                children: [
                    // Tab Bar - Horizontal row
                    {
                        slot: 'tabBar',
                        leaf: {
                            tag: 'div',
                            classes: 'flex flex-row gap-2 pb-4',
                            children: [
                                {
                                    tag: 'button',
                                    attributes: { type: 'button' },
                                    classes: tabButtonListActive.classes,
                                    bindings: {
                                        visible: "data.selectedLayout === 'list'",
                                    },
                                    events: {
                                        click: {
                                            event: 'SWITCH_LAYOUT',
                                            payload: { layout: 'list' },
                                        },
                                    },
                                    children: ['List'],
                                },
                                {
                                    tag: 'button',
                                    attributes: { type: 'button' },
                                    classes: tabButtonList.classes,
                                    bindings: {
                                        visible: "data.selectedLayout !== 'list'",
                                    },
                                    events: {
                                        click: {
                                            event: 'SWITCH_LAYOUT',
                                            payload: { layout: 'list' },
                                        },
                                    },
                                    children: ['List'],
                                },
                                {
                                    tag: 'button',
                                    attributes: { type: 'button' },
                                    classes: tabButtonRowActive.classes,
                                    bindings: {
                                        visible: "data.selectedLayout === 'row'",
                                    },
                                    events: {
                                        click: {
                                            event: 'SWITCH_LAYOUT',
                                            payload: { layout: 'row' },
                                        },
                                    },
                                    children: ['Row'],
                                },
                                {
                                    tag: 'button',
                                    attributes: { type: 'button' },
                                    classes: tabButtonRow.classes,
                                    bindings: {
                                        visible: "data.selectedLayout !== 'row'",
                                    },
                                    events: {
                                        click: {
                                            event: 'SWITCH_LAYOUT',
                                            payload: { layout: 'row' },
                                        },
                                    },
                                    children: ['Row'],
                                },
                                {
                                    tag: 'button',
                                    attributes: { type: 'button' },
                                    classes: tabButtonGridActive.classes,
                                    bindings: {
                                        visible: "data.selectedLayout === 'grid'",
                                    },
                                    events: {
                                        click: {
                                            event: 'SWITCH_LAYOUT',
                                            payload: { layout: 'grid' },
                                        },
                                    },
                                    children: ['Grid'],
                                },
                                {
                                    tag: 'button',
                                    attributes: { type: 'button' },
                                    classes: tabButtonGrid.classes,
                                    bindings: {
                                        visible: "data.selectedLayout !== 'grid'",
                                    },
                                    events: {
                                        click: {
                                            event: 'SWITCH_LAYOUT',
                                            payload: { layout: 'grid' },
                                        },
                                    },
                                    children: ['Grid'],
                                },
                            ],
                        },
                    },
                    // Content Area - Using Leaf Nodes with Tailwind
                    {
                        slot: 'content',
                        leaf: {
                            tag: 'div',
                            classes: 'w-full h-full relative overflow-hidden flex-grow flex-shrink flex-basis-0 min-h-0',
                            children: [
                                // List View - Tailwind flex column
                                {
                                    tag: 'div',
                                    classes: 'absolute inset-0 w-full h-full flex flex-col gap-6 overflow-auto p-4',
                                    bindings: {
                                        visible: "data.selectedLayout === 'list'",
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            classes: 'bg-red-100 border border-red-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-red-700 font-medium',
                                                    children: ['Item 1'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-blue-100 border border-blue-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-blue-700 font-medium',
                                                    children: ['Item 2'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-green-100 border border-green-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-green-700 font-medium',
                                                    children: ['Item 3'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-yellow-100 border border-yellow-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-yellow-700 font-medium',
                                                    children: ['Item 4'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-purple-100 border border-purple-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-purple-700 font-medium',
                                                    children: ['Item 5'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-pink-100 border border-pink-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-pink-700 font-medium',
                                                    children: ['Item 6'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-orange-100 border border-orange-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-orange-700 font-medium',
                                                    children: ['Item 7'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-indigo-100 border border-indigo-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-indigo-700 font-medium',
                                                    children: ['Item 8'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-teal-100 border border-teal-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-teal-700 font-medium',
                                                    children: ['Item 9'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-cyan-100 border border-cyan-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-cyan-700 font-medium',
                                                    children: ['Item 10'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-emerald-100 border border-emerald-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-emerald-700 font-medium',
                                                    children: ['Item 11'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-violet-100 border border-violet-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-violet-700 font-medium',
                                                    children: ['Item 12'],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                // Row View - Optimized with configurable height prop
                                // Each row item has a height prop using Tailwind classes (default: h-[150px])
                                // To customize: change 'h-[150px]' to 'h-[200px]', 'h-auto', 'h-full', etc.
                                // Single horizontal row with horizontal scrolling (no wrapping)
                                {
                                    tag: 'div',
                                    classes: 'absolute inset-0 w-full h-full flex flex-row flex-nowrap gap-6 overflow-x-auto overflow-y-hidden p-4',
                                    bindings: {
                                        visible: "data.selectedLayout === 'row'",
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            classes: 'bg-red-100 border border-red-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-red-700 font-medium',
                                                    children: ['Item 1'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-blue-100 border border-blue-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-blue-700 font-medium',
                                                    children: ['Item 2'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-green-100 border border-green-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-green-700 font-medium',
                                                    children: ['Item 3'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-yellow-100 border border-yellow-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-yellow-700 font-medium',
                                                    children: ['Item 4'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-purple-100 border border-purple-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-purple-700 font-medium',
                                                    children: ['Item 5'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-pink-100 border border-pink-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-pink-700 font-medium',
                                                    children: ['Item 6'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-orange-100 border border-orange-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-orange-700 font-medium',
                                                    children: ['Item 7'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-indigo-100 border border-indigo-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-indigo-700 font-medium',
                                                    children: ['Item 8'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-teal-100 border border-teal-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-teal-700 font-medium',
                                                    children: ['Item 9'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-cyan-100 border border-cyan-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-cyan-700 font-medium',
                                                    children: ['Item 10'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-emerald-100 border border-emerald-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-emerald-700 font-medium',
                                                    children: ['Item 11'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-violet-100 border border-violet-300 rounded-2xl p-4 flex items-center justify-center min-w-[200px] flex-shrink-0 h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-violet-700 font-medium',
                                                    children: ['Item 12'],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                // Grid View - Tailwind grid
                                // Vertical scrolling by default (overflow-y-auto)
                                {
                                    tag: 'div',
                                    classes: 'absolute inset-0 w-full h-full grid grid-cols-3 gap-6 overflow-y-auto overflow-x-hidden p-4',
                                    bindings: {
                                        visible: "data.selectedLayout === 'grid'",
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            classes: 'bg-red-100 border border-red-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-red-700 font-medium',
                                                    children: ['Item 1'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-blue-100 border border-blue-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-blue-700 font-medium',
                                                    children: ['Item 2'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-green-100 border border-green-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-green-700 font-medium',
                                                    children: ['Item 3'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-yellow-100 border border-yellow-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-yellow-700 font-medium',
                                                    children: ['Item 4'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-purple-100 border border-purple-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-purple-700 font-medium',
                                                    children: ['Item 5'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-pink-100 border border-pink-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-pink-700 font-medium',
                                                    children: ['Item 6'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-orange-100 border border-orange-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-orange-700 font-medium',
                                                    children: ['Item 7'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-indigo-100 border border-indigo-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-indigo-700 font-medium',
                                                    children: ['Item 8'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-teal-100 border border-teal-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-teal-700 font-medium',
                                                    children: ['Item 9'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-cyan-100 border border-cyan-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-cyan-700 font-medium',
                                                    children: ['Item 10'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-emerald-100 border border-emerald-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-emerald-700 font-medium',
                                                    children: ['Item 11'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: 'bg-violet-100 border border-violet-300 rounded-2xl p-4 flex items-center justify-center min-h-[150px]',
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: 'text-violet-700 font-medium',
                                                    children: ['Item 12'],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ],
}

