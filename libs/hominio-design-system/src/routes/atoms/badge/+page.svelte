<script>
    import { css } from 'styled-system/css';
    import Badge from '$lib/components/atoms/Badge.svelte';
    import Label from '$lib/components/atoms/Label.svelte';
    import PreviewBackground from '$lib/components/atoms/PreviewBackground.svelte';

    const variants = ['primary', 'secondary', 'accent', 'success', 'warning', 'alert', 'info', 'slate'];
    const sizes = ['xs', 'sm', 'md', 'lg'];
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Badge</h1>
        <p>Small status indicators and labels with color variants. Supports all color palettes and multiple sizes.</p>
    </div>

    <!-- Color Variants -->
    <div class={css({ spaceY: '6' })}>
        <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Color Variants</h2>
        <div class={css({ 
            position: 'relative', 
            bg: 'slate.300', 
            rounded: 'xl', 
            p: '12',
            minH: '96',
            overflow: 'hidden',
            borderWidth: '1px',
            borderColor: 'slate.200'
        })}>
            <!-- Dotted background pattern -->
            <PreviewBackground opacity="0.5" />
            
            <!-- Content -->
            <div class={css({ 
                position: 'relative', 
                zIndex: '10', 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '4',
                alignItems: 'center',
                justifyContent: 'center'
            })}>
                {#each variants as variant}
                    <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                        <Badge variant={variant}>Badge</Badge>
                        <Label size="xs">{variant}</Label>
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <!-- Sizes -->
    <div class={css({ spaceY: '6' })}>
        <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Sizes</h2>
        <div class={css({ 
            position: 'relative', 
            bg: 'slate.300', 
            rounded: 'xl', 
            p: '12',
            minH: '96',
            overflow: 'hidden',
            borderWidth: '1px',
            borderColor: 'slate.200'
        })}>
            <!-- Dotted background pattern -->
            <PreviewBackground opacity="0.5" />
            
            <!-- Content -->
            <div class={css({ 
                position: 'relative', 
                zIndex: '10', 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6',
                alignItems: 'center',
                justifyContent: 'center'
            })}>
                {#each sizes as size}
                    <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                        <Badge variant="primary" size={size}>Badge</Badge>
                        <Label size="xs">{size}</Label>
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <!-- Examples -->
    <div class={css({ spaceY: '6' })}>
        <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Examples</h2>
        <div class={css({ 
            position: 'relative', 
            bg: 'slate.300', 
            rounded: 'xl', 
            p: '12',
            minH: '96',
            overflow: 'hidden',
            borderWidth: '1px',
            borderColor: 'slate.200'
        })}>
            <!-- Dotted background pattern -->
            <PreviewBackground opacity="0.5" />
            
            <!-- Content -->
            <div class={css({ 
                position: 'relative', 
                zIndex: '10', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '6',
                alignItems: 'center',
                justifyContent: 'center'
            })}>
                <div class={css({ display: 'flex', gap: '3', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' })}>
                    <Badge variant="success">Active</Badge>
                    <Badge variant="alert">Error</Badge>
                    <Badge variant="warning">Pending</Badge>
                    <Badge variant="info">New</Badge>
                </div>
                
                <div class={css({ display: 'flex', gap: '3', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' })}>
                    <Badge variant="primary" size="xs">12</Badge>
                    <Badge variant="secondary" size="sm">99+</Badge>
                    <Badge variant="accent" size="md">Featured</Badge>
                    <Badge variant="slate" size="lg">Default</Badge>
                </div>
            </div>
        </div>
    </div>

    <!-- Props -->
    <div class={css({ 
        maxWidth: 'none', 
        '& h3': { fontSize: 'xl', fontWeight: 'bold', mt: '6', mb: '3' },
        '& p': { mb: '4' },
        '& ul': { listStyleType: 'disc', pl: '5', spaceY: '1' },
        '& code': { bg: 'slate.100', px: '1', py: '0.5', rounded: 'sm', fontSize: 'sm' }
    })}>
        <h3>Props</h3>
        <ul>
            <li><strong>variant:</strong> Color variant - 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'alert' | 'info' | 'slate' (default: 'primary')</li>
            <li><strong>size:</strong> Size - 'xs' | 'sm' | 'md' | 'lg' (default: 'sm')</li>
            <li><strong>rounded:</strong> Border radius - 'xs' | 'sm' | 'md' | 'lg' | 'full' (default: 'full')</li>
            <li><strong>children:</strong> Badge text content</li>
        </ul>
        
        <h3>Usage</h3>
        <pre class={css({ bg: 'slate.100', p: '4', rounded: 'md', overflow: 'auto' })}>
            <code>{`<script>
  import Badge from '$lib/components/atoms/Badge.svelte';
</script>

<Badge variant="success">Active</Badge>
<Badge variant="alert" size="sm">Error</Badge>
<Badge variant="primary" rounded="md">Custom</Badge>`}</code>
        </pre>
    </div>
</div>

