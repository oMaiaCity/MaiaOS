<script>
    import { css } from 'styled-system/css';
    import Icon from '@iconify/svelte';
    import Label from '$lib/components/leafs/Label.svelte';
    import PreviewBackground from '$lib/components/leafs/PreviewBackground.svelte';

    const icons = [
        { name: 'Bell', icon: 'lucide:bell' },
        { name: 'Mic', icon: 'lucide:mic' },
        { name: 'Mic Off', icon: 'lucide:mic-off' },
        { name: 'Heart', icon: 'lucide:heart' }
    ];
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Lucide Icons</h1>
        <p>Icon library using Lucide via Iconify. Currently available icons.</p>
    </div>

    <div class={css({ 
        position: 'relative',
        p: '6', 
        borderWidth: '1px', 
        borderColor: 'slate.200', 
        rounded: 'xl', 
        bg: 'slate.300',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '4'
    })}>
        <!-- Dotted background pattern -->
        <PreviewBackground opacity="0.5" />
        
        {#each icons as iconItem}
            <div class={css({ 
                position: 'relative',
                zIndex: '10',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '2',
                p: '4',
                rounded: 'md',
                bg: 'slate.50',
                _hover: { bg: 'slate.100' }
            })}>
                <Icon icon={iconItem.icon} class={css({ fontSize: '2xl', color: 'primary.500' })} />
                <Label size="sm">{iconItem.name}</Label>
                <code class={css({ fontSize: 'xs', textAlign: 'center', wordBreak: 'break-all' })}>
                    {iconItem.icon}
                </code>
            </div>
        {/each}
    </div>

    <div class={css({ 
        maxWidth: 'none', 
        '& h3': { fontSize: 'xl', fontWeight: 'bold', mt: '6', mb: '3' },
        '& p': { mb: '4' },
        '& ul': { listStyleType: 'disc', pl: '5', spaceY: '1' },
        '& code': { bg: 'slate.100', px: '1', py: '0.5', rounded: 'sm', fontSize: 'sm' }
    })}>
        <h3>Usage</h3>
        <p>
            We use Lucide icons via Iconify. Use the <code>&lt;Icon&gt;</code> component from <code>@iconify/svelte</code>.
        </p>
        
        <h3>Example</h3>
        <pre class={css({ bg: 'slate.100', p: '4', rounded: 'md', overflow: 'auto' })}>
            <code>{`<script>
  import Icon from '@iconify/svelte';
</script>

<Icon icon="lucide:bell" />`}</code>
        </pre>
        
        <h3>Available Icons</h3>
        <ul>
            <li><strong>Bell:</strong> <code>lucide:bell</code> - Notification icon</li>
            <li><strong>Mic:</strong> <code>lucide:mic</code> - Microphone icon (active state)</li>
            <li><strong>Mic Off:</strong> <code>lucide:mic-off</code> - Microphone off icon (inactive state)</li>
            <li><strong>Heart:</strong> <code>lucide:heart</code> - Heart/favorite icon</li>
        </ul>
        
        <h3>Features</h3>
        <ul>
            <li><strong>Lucide Icons:</strong> Beautiful & consistent icon toolkit</li>
            <li><strong>Tree-shakeable:</strong> Only icons you use are included</li>
            <li><strong>Customizable:</strong> Size, color, and styling via CSS</li>
            <li><strong>Type-safe:</strong> Full TypeScript support</li>
        </ul>
    </div>
</div>

