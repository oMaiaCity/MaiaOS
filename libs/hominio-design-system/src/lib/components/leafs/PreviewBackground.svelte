<script>
    import { css } from 'styled-system/css';

    // Svelte 5 Runes
    let {
        opacity = '0.3',
        dotColor = 'slate.400',
        dotSize = '1px',
        gridSize = '20px',
        ...rest
    } = $props();

    // Convert dotColor to CSS variable format (slate.400 -> slate-400)
    let cssVar = $derived(`--colors-${dotColor.replace('.', '-')}`);
    let backgroundImageStyle = $derived(`radial-gradient(circle, var(${cssVar}) ${dotSize}, transparent ${dotSize})`);
    let backgroundSizeStyle = $derived(`${gridSize} ${gridSize}`);
    
    const backgroundStyle = css({
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '0',
        rounded: 'card'
    });
</script>

<div 
    class={backgroundStyle}
    style="background-image: {backgroundImageStyle}; background-size: {backgroundSizeStyle}; opacity: {opacity};"
    {...rest}
></div>

