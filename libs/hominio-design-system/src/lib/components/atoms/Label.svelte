<script>
    import { css } from 'styled-system/css';

    export let size = 'xs';
    export let weight = 'medium';

    const labelStyle = css({
        fontSize: size,
        fontWeight: weight,
        // Inherits primary.500 from global typography
    });
</script>

<span class={labelStyle}>
    <slot />
</span>

