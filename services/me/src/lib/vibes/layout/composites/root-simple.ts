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
    type: 'stack',
    container: {
        class: 'h-full w-full max-w-6xl mx-auto flex flex-col',
        padding: '1.5rem 1.5rem',
    },
    children: [
        {
            slot: 'cardContainer',
            flex: {
                grow: 1,
                shrink: 1,
                basis: '0',
            },
            composite: {
                type: 'stack',
                container: {
                    class: 'card h-full p-6',
                },
                overflow: 'hidden',
                children: [
                    // Tab Bar - Horizontal row
                    {
                        slot: 'tabBar',
                        leaf: {
                            tag: 'div',
                            classes: ['flex', 'flex-row', 'gap-2', 'pb-4'],
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
                        flex: {
                            grow: 1,
                            shrink: 1,
                            basis: '0',
                        },
                        size: {
                            minHeight: '0',
                        },
                        overflow: 'hidden',
                        leaf: {
                            tag: 'div',
                            classes: ['w-full', 'h-full', 'relative', 'overflow-hidden'],
                            children: [
                                // List View - Tailwind flex column
                                {
                                    tag: 'div',
                                    classes: [
                                        'absolute',
                                        'inset-0',
                                        'w-full',
                                        'h-full',
                                        'flex',
                                        'flex-col',
                                        'gap-6',
                                        'overflow-auto',
                                        'p-4',
                                    ],
                                    bindings: {
                                        visible: "data.selectedLayout === 'list'",
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-red-100',
                                                'border',
                                                'border-red-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-red-700', 'font-medium'],
                                                    children: ['Item 1'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-blue-100',
                                                'border',
                                                'border-blue-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-blue-700', 'font-medium'],
                                                    children: ['Item 2'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-green-100',
                                                'border',
                                                'border-green-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-green-700', 'font-medium'],
                                                    children: ['Item 3'],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                // Row View - Tailwind flex row wrap
                                {
                                    tag: 'div',
                                    classes: [
                                        'absolute',
                                        'inset-0',
                                        'w-full',
                                        'h-full',
                                        'flex',
                                        'flex-row',
                                        'flex-wrap',
                                        'gap-6',
                                        'overflow-auto',
                                        'p-4',
                                    ],
                                    bindings: {
                                        visible: "data.selectedLayout === 'row'",
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-red-100',
                                                'border',
                                                'border-red-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                                'min-w-[200px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-red-700', 'font-medium'],
                                                    children: ['Item 1'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-blue-100',
                                                'border',
                                                'border-blue-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                                'min-w-[200px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-blue-700', 'font-medium'],
                                                    children: ['Item 2'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-green-100',
                                                'border',
                                                'border-green-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                                'min-w-[200px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-green-700', 'font-medium'],
                                                    children: ['Item 3'],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                // Grid View - Tailwind grid
                                {
                                    tag: 'div',
                                    classes: [
                                        'absolute',
                                        'inset-0',
                                        'w-full',
                                        'h-full',
                                        'grid',
                                        'grid-cols-3',
                                        'gap-6',
                                        'overflow-auto',
                                        'p-4',
                                    ],
                                    bindings: {
                                        visible: "data.selectedLayout === 'grid'",
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-red-100',
                                                'border',
                                                'border-red-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-red-700', 'font-medium'],
                                                    children: ['Item 1'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-blue-100',
                                                'border',
                                                'border-blue-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-blue-700', 'font-medium'],
                                                    children: ['Item 2'],
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'div',
                                            classes: [
                                                'bg-green-100',
                                                'border',
                                                'border-green-300',
                                                'rounded-2xl',
                                                'p-4',
                                                'flex',
                                                'items-center',
                                                'justify-center',
                                                'min-h-[150px]',
                                            ],
                                            children: [
                                                {
                                                    tag: 'span',
                                                    classes: ['text-green-700', 'font-medium'],
                                                    children: ['Item 3'],
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

