<script>
    import { css } from 'styled-system/css';
    import Label from '$lib/components/leafs/Label.svelte';
    import PreviewBackground from '$lib/components/leafs/PreviewBackground.svelte';
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Label</h1>
        <p>Reusable label component for descriptions and metadata. Inherits primary.500 color from global typography.</p>
    </div>

    <!-- Preview -->
    <div class={css({ 
        position: 'relative', 
        bg: 'slate.300', 
        rounded: 'xl', 
        p: '12',
        minH: '96',
        overflow: 'hidden',
        borderWidth: '1px',
        borderColor: 'slate.200',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8'
    })}>
        <!-- Dotted background pattern -->
        <PreviewBackground opacity="0.5" />
        
        <!-- Content -->
        <div class={css({ position: 'relative', zIndex: '10', display: 'flex', gap: '8', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' })}>
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <div class={css({ w: '16', h: '16', bg: 'primary.500', rounded: 'full' })}></div>
                <Label>Default Label</Label>
            </div>
            
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <div class={css({ w: '16', h: '16', bg: 'secondary.500', rounded: 'full' })}></div>
                <Label size="sm">Small Label</Label>
            </div>
            
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <div class={css({ w: '16', h: '16', bg: 'accent.500', rounded: 'full' })}></div>
                <Label size="xs" weight="semibold">Extra Small Semibold</Label>
            </div>
        </div>
    </div>

    <!-- Props -->
    <div class={css({ spaceY: '4' })}>
        <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Props</h2>
        <ul class={css({ spaceY: '2', listStyle: 'none' })}>
            <li><strong>size:</strong> Font size (default: 'xs')</li>
            <li><strong>weight:</strong> Font weight (default: 'medium')</li>
            <li><strong>children:</strong> Label text content</li>
        </ul>
    </div>
</div>

