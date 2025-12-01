<script>
    import { css, cx } from 'styled-system/css';

    // Svelte 5 Runes
    let {
        value = $bindable(),
        placeholder = '',
        disabled = false,
        onKeydown = () => {},
        onInput = () => {},
        class: className = '',
        ...rest
    } = $props();
    
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
    class={cx(css(baseStyle), className, css(rest))}
    bind:value
    {placeholder}
    {disabled}
    onkeydown={handleKeydown}
    oninput={handleInput}
/>
