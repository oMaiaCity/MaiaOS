<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { css } from 'styled-system/css';

    onMount(() => {
        goto('/tokens/colors');
    });
</script>

<div class={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', h: '64' })}>
    <div class={css({ animation: 'pulse' })}>Redirecting to catalog...</div>
</div>
