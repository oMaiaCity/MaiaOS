<script>
    import { resolveComponent } from './registry.js';
    import Icon from '@iconify/svelte';
    import { css, cx } from 'styled-system/css';

    // Svelte 5 Runes
    let { 
        component = '', 
        style = {}, 
        data = {}, 
        events = {}, 
        dispatch = () => {} 
    } = $props();

    // Resolve component class/function
    // In Svelte 5, we can use this capitalized variable directly in the template
    const Component = resolveComponent(component);

    // Combine style and data into props reactively
    let props = $derived({ ...style, ...data });

    // Handle events
    function createEventHandler(eventName, eventConfig) {
        return (e) => {
            if (eventConfig.send) {
                dispatch(eventConfig.send, e);
            }
        };
    }

    // Build event handlers prop reactively
    let eventHandlers = $derived.by(() => {
        const handlers = {};
        if (events) {
            Object.entries(events).forEach(([evtName, config]) => {
                let propName = evtName;
                if (['click', 'input', 'keydown', 'change', 'focus', 'blur'].includes(evtName)) {
                    propName = 'on' + evtName.charAt(0).toUpperCase() + evtName.slice(1);
                }
                handlers[propName] = createEventHandler(evtName, config);
            });
        }
        return handlers;
    });

    // Merge event handlers into props
    let finalProps = $derived({ ...props, ...eventHandlers });

    // Extract content props
    let content = $derived(finalProps.text || finalProps.children || finalProps.label);
    
    // Icon handling
    let isIconComponent = $derived(component === 'Button' || component === 'IconButton' || component === 'CallButton');
    let icon = $derived(!isIconComponent ? finalProps.icon : undefined);
</script>

{#if Component}
    <!-- Svelte 5: Use capitalized variable directly instead of <svelte:component> -->
    <Component {...finalProps}>
        {#if icon}
            <div class={css({ display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                <Icon icon={icon} />
            </div>
        {/if}
        {#if content}
            {content}
        {/if}
    </Component>
{:else}
    <div class={css({ color: 'red.500', border: '1px dashed red', p: '2' })}>
        Unknown component: {component}
    </div>
{/if}
