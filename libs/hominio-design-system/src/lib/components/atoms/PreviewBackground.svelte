<script>
    import { css } from 'styled-system/css';

    export let opacity = '0.3';
    export let dotColor = 'light.400'; // Darker than background for visibility
    export let dotSize = '1px';
    export let gridSize = '20px';

    // Convert dotColor to CSS variable format (light.400 -> light-400)
    $: cssVar = `--colors-${dotColor.replace('.', '-')}`;
    $: backgroundImageStyle = `radial-gradient(circle, var(${cssVar}) ${dotSize}, transparent ${dotSize})`;
    $: backgroundSizeStyle = `${gridSize} ${gridSize}`;
    
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
></div>

