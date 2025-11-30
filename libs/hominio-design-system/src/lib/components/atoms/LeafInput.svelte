<script>
    import { css, cx } from 'styled-system/css';

    export let value = '';
    export let placeholder = '';
    export let disabled = false;
    export let onKeydown = () => {};
    export let onInput = () => {};
    
    // Support external styles via props or class
    // In Leaf architecture, style props are passed as... well, 'style' object in Leaf.svelte
    // maps to props.
    // But Panda CSS usually expects a class string.
    // Let's accept a `wrapperClass` or just `class` if possible.
    // Since Svelte 5 / standard props, let's use standard class prop.
    let className = '';
    export { className as class }; 
    
    // Also accept style object for Panda overrides?
    // For now, let's assume style props passed from Leaf are converted to classes?
    // Actually Leaf.svelte passes `style` prop which is an object. 
    // We should merge that object into our css() call if we want to support dynamic styles.
    // But Leaf.svelte: `$: props = { ...style, ...data };` -> spreads into component.
    // So `style` object props are passed as individual props!
    // e.g. `flex: "1"` passed as `flex="1"`.
    // So we need to capture rest props and assume they might be style props?
    // Or we just rely on `class` being passed if the caller generates it?
    // Composite.svelte uses `css()` for layout.
    // Leaf.svelte doesn't use `css()` on the props. It passes them raw.
    
    // We need to handle raw style props if we want to support `flex: 1` passed from config.
    // Strategy: spread $$restProps into css().
    
    const baseStyle = {
        width: 'full',
        px: '6', // Larger padding
        py: '4', // Larger padding for "xl" feel
        bg: 'slate.50',
        borderWidth: '1px',
        borderColor: 'slate.200',
        rounded: 'full',
        outline: 'none',
        transition: 'all 0.2s',
        fontSize: 'lg', // Larger text
        _focus: {
            borderColor: 'primary.500',
            bg: 'white',
            boxShadow: '0 0 0 4px {colors.primary.100}'
        },
        _disabled: {
            bg: 'slate.100',
            cursor: 'not-allowed'
        }
    };

    function handleKeydown(e) {
        if (onKeydown) onKeydown(e);
    }

    function handleInput(e) {
        value = e.target.value;
        if (onInput) onInput(e);
    }
</script>

<input
    type="text"
    class={cx(css(baseStyle), className, css($$restProps))}
    {value}
    {placeholder}
    {disabled}
    on:keydown={handleKeydown}
    on:input={handleInput}
/>
