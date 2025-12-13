/**
 * Layout Vibe Root Composite
 * Outer card container with max-w-6xl
 * Includes tab bar for switching between list, row, and grid layouts
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { createTestBoxes } from './testBoxes'
import {
    tabButtonGrid,
    tabButtonGridActive,
    tabButtonList,
    tabButtonListActive,
    tabButtonRow,
    tabButtonRowActive,
} from '../leafs/tabButtons'

const testBoxes = createTestBoxes()

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
                    // Header
                    {
                        slot: 'header',
                        composite: {
                            type: 'stack',
                            container: {
                                class: 'pb-6 border-b border-slate-200',
                            },
                            children: [
                                {
                                    slot: 'title',
                                    leaf: {
                                        tag: 'h2',
                                        classes: ['text-lg', 'font-semibold', 'text-slate-700', 'm-0'],
                                        bindings: {
                                            text: 'data.title',
                                        },
                                    },
                                },
                                {
                                    slot: 'subtitle',
                                    leaf: {
                                        tag: 'p',
                                        classes: ['text-sm', 'text-slate-600', 'mt-1'],
                                        bindings: {
                                            text: 'data.subtitle',
                                        },
                                    },
                                },
                            ],
                        },
                    },
                    // Tab Bar
                    {
                        slot: 'tabBar',
                        composite: {
                            type: 'row',
                            spacing: 0.5,
                            container: {
                                class: 'pt-6 pb-4',
                            },
                            children: [
                                {
                                    slot: 'tabList.active',
                                    leaf: tabButtonListActive,
                                },
                                {
                                    slot: 'tabList',
                                    leaf: tabButtonList,
                                },
                                {
                                    slot: 'tabRow.active',
                                    leaf: tabButtonRowActive,
                                },
                                {
                                    slot: 'tabRow',
                                    leaf: tabButtonRow,
                                },
                                {
                                    slot: 'tabGrid.active',
                                    leaf: tabButtonGridActive,
                                },
                                {
                                    slot: 'tabGrid',
                                    leaf: tabButtonGrid,
                                },
                            ],
                        },
                    },
                    // Views Container - overlay pattern with absolute positioning
                    {
                        slot: 'viewsContainer',
                        flex: {
                            grow: 1,
                            shrink: 1,
                            basis: '0',
                        },
                        size: {
                            minHeight: '0',
                        },
                        composite: {
                            type: 'overlay',
                            container: {
                                class: 'relative w-full h-full',
                            },
                            children: [
                                // List View
                                {
                                    slot: 'listView',
                                    visible: 'data.selectedLayout === "list"',
                                    position: {
                                        type: 'absolute',
                                        top: '0',
                                        left: '0',
                                        right: '0',
                                        bottom: '0',
                                    },
                                    overflow: 'auto',
                                    flex: {
                                        grow: 1,
                                        shrink: 1,
                                        basis: '0',
                                    },
                                    composite: {
                                        type: 'list',
                                        spacing: 1.5,
                                        container: {
                                            class: 'w-full h-full p-4',
                                        },
                                        children: [
                                            // Add a simple test box first to verify rendering
                                            {
                                                slot: 'testBox',
                                                leaf: {
                                                    tag: 'div',
                                                    classes: ['bg-red-500', 'p-4', 'text-white', 'rounded'],
                                                    children: ['TEST BOX - If you see this, rendering works!'],
                                                },
                                            },
                                            ...testBoxes,
                                        ],
                                    },
                                },
                                // Row View
                                {
                                    slot: 'rowView',
                                    visible: 'data.selectedLayout === "row"',
                                    position: {
                                        type: 'absolute',
                                        top: '0',
                                        left: '0',
                                        right: '0',
                                        bottom: '0',
                                    },
                                    overflow: 'auto',
                                    flex: {
                                        grow: 1,
                                        shrink: 1,
                                        basis: '0',
                                    },
                                    composite: {
                                        type: 'row',
                                        spacing: 1.5,
                                        wrap: true,
                                        container: {
                                            class: 'w-full h-full',
                                        },
                                        children: testBoxes,
                                    },
                                },
                                // Grid View
                                {
                                    slot: 'gridView',
                                    visible: 'data.selectedLayout === "grid"',
                                    position: {
                                        type: 'absolute',
                                        top: '0',
                                        left: '0',
                                        right: '0',
                                        bottom: '0',
                                    },
                                    overflow: 'auto',
                                    flex: {
                                        grow: 1,
                                        shrink: 1,
                                        basis: '0',
                                    },
                                    composite: {
                                        type: 'grid',
                                        columns: 3,
                                        spacing: 1.5,
                                        container: {
                                            class: 'w-full h-full',
                                        },
                                        children: testBoxes,
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ],
}
