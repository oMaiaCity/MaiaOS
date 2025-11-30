<script>
    import { css, cx } from 'styled-system/css';
    import { createMachine } from './fsm.js';
    import Leaf from './Leaf.svelte';
    import { resolveData } from './data.js';
    import { onDestroy } from 'svelte';
    // Svelte 5: Self-import for recursion
    import Composite from './Composite.svelte';

    // Svelte 5 Runes - Props
    let { config = {}, context = {} } = $props();

    // Derived config properties for easier access
    let id = $derived(config.id);
    let layout = $derived(config.layout);
    let stateMachine = $derived(config.stateMachine);
    let children = $derived(config.children);
    let dataSource = $derived(config.dataSource);
    let itemTemplate = $derived(config.itemTemplate);

    // --- State Machine Handling ---
    let fsmInstance = $state();
    let fsmState = $state({ value: 'idle', context: {} });

    // Initialize and subscribe to FSM
    $effect(() => {
        if (stateMachine) {
            const machine = createMachine(stateMachine, context);
            fsmInstance = machine;
            const unsub = machine.state.subscribe(s => {
                fsmState = s;
            });
            return unsub;
        }
    });

    let currentStateVal = $derived(fsmState.value);
    let currentContext = $derived(fsmState.context);

    const dispatch = (event, payload) => {
        if (fsmInstance) fsmInstance.send(event, payload);
    };

    // --- Layout Styles ---
    let layoutStyle = $derived.by(() => {
        if (!layout) return '';
        
        const { type, columns, gap, padding, background, rounded, border, direction, align } = layout;
        
        let styles = {
            display: type === 'grid' ? 'grid' : 'flex',
            gap: gap, // Assuming tokenVal is handled by css() or we pass raw
            p: padding,
            bg: background,
            rounded: rounded,
            borderWidth: border ? '1px' : undefined,
            borderColor: border ? 'slate.200' : undefined,
            containerType: 'inline-size',
            width: layout.width,
            maxWidth: layout.maxWidth,
            margin: layout.margin
        };

        if (type === 'grid') {
            styles.gridTemplateColumns = columns || '1fr';
            styles.alignItems = align || 'stretch';
        } else {
            styles.flexDirection = direction || 'row';
            styles.alignItems = align || 'stretch';
        }
        
        return css(styles);
    });

    // --- Data Source (List Rendering) ---
    let items = $state([]);
    
    // Resolve the store itself (it might depend on context)
    let sourceStore = $derived(dataSource ? resolveData(dataSource, context) : null);

    // Subscribe to store updates
    $effect(() => {
        if (sourceStore && typeof sourceStore.subscribe === 'function') {
            const unsub = sourceStore.subscribe(val => {
                items = val || [];
            });
            return unsub;
        } else {
            items = [];
        }
    });

    // --- Prop Resolution Helper ---
    const resolveProps = (childData, itemContext, fsmCtx) => {
        if (!childData) return {};
        
        // Construct a fresh context for resolution
        const combinedContext = { 
            ...context, 
            ...(itemContext ? { item: itemContext } : {}), 
            ...(fsmCtx || {}),
            state: { matches: (val) => currentStateVal === val }
        };

        const resolved = {};
        for (const [key, val] of Object.entries(childData)) {
            resolved[key] = resolveData(val, combinedContext);
        }
        return resolved;
    };

    // --- Resolve Children Props Reactively ---
    // This is the core fix for Svelte 5: use $derived to track context changes
    let resolvedChildrenProps = $derived.by(() => {
        if (!children) return [];
        
        // Access context.item directly to ensure dependency tracking
        // When parent passes a new context object (due to item update), this re-runs
        const itemFromContext = context.item; 
        
        return children.map((child, index) => {
            if (child.type === 'Leaf') {
                return {
                    style: resolveProps(child.styles || child.style, itemFromContext, currentContext),
                    data: resolveProps(child.data, itemFromContext, currentContext)
                };
            }
            // For Composite children, props are passed via context in template
            return { style: {}, data: {} };
        });
    });

</script>

<div class={layoutStyle} id={id}>
    {#if dataSource && sourceStore}
        <!-- Render List -->
        {#each items as item (item.id || item)}
            <!-- 
                Recursive Composite for list items.
                Svelte 5: Use self-imported Composite component.
                We pass a FRESH context object containing the item.
            -->
            <Composite 
                config={itemTemplate} 
                context={{ ...context, item }} 
            />
        {/each}
    {:else}
        <!-- Render Children -->
        {#if children}
            {#each children as child, i}
                {#if child.type === 'Leaf'}
                    <Leaf 
                        component={child.component || child.atom} 
                        style={resolvedChildrenProps[i]?.style || {}}
                        data={resolvedChildrenProps[i]?.data || {}}
                        events={child.events}
                        dispatch={dispatch}
                    />
                {:else if child.type === 'Composite'}
                    <Composite 
                        config={child} 
                        context={context} 
                    />
                {/if}
            {/each}
        {/if}
    {/if}
</div>
