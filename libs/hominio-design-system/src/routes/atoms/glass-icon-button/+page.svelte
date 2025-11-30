<script>
    import { css } from 'styled-system/css';
    import GlassIconButton from '$lib/components/atoms/GlassIconButton.svelte';
    import Icon from '@iconify/svelte';
    import PreviewBackground from '$lib/components/atoms/PreviewBackground.svelte';
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'light.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Glass Icon Button</h1>
        <p>Transparent icon button with hover effects for glassmorphism UI.</p>
    </div>

    <!-- Demo Container -->
    <div class={css({ 
        position: 'relative', 
        h: '400px', 
        w: 'full', 
        bg: 'light.300', 
        rounded: 'xl', 
        overflow: 'hidden', 
        borderWidth: '1px', 
        borderColor: 'light.200', 
        shadow: 'inner', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '4',
        flexWrap: 'wrap'
    })}>
        <!-- Background Pattern -->
        <PreviewBackground opacity="0.5" />
        
        <!-- Various Sizes -->
        <div class={css({ display: 'flex', gap: '4', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: '10' })}>
            <GlassIconButton label="Small" size={css({ w: '8', h: '8' })}>
                <Icon icon="lucide:bell" class={css({ fontSize: 'sm' })} />
            </GlassIconButton>
            
            <GlassIconButton label="Medium" size={css({ w: '11', h: '11' })}>
                <Icon icon="lucide:bell" class={css({ fontSize: 'xl' })} />
            </GlassIconButton>
            
            <GlassIconButton label="Large" size={css({ w: '14', h: '14' })}>
                <Icon icon="lucide:bell" class={css({ fontSize: '2xl' })} />
            </GlassIconButton>
        </div>
    </div>

    <div class={css({ 
        maxWidth: 'none', 
        '& h3': { fontSize: 'xl', fontWeight: 'bold', mt: '6', mb: '3' },
        '& p': { mb: '4' },
        '& ul': { listStyleType: 'disc', pl: '5', spaceY: '1' },
        '& code': { bg: 'light.100', px: '1', py: '0.5', rounded: 'sm', fontSize: 'sm' }
    })}>
        <h3>Usage</h3>
        <p>
            Glass Icon Button provides a transparent button with subtle hover effects, perfect for glassmorphism designs.
        </p>
        
        <h3>Features</h3>
        <ul>
            <li><strong>Transparent Background:</strong> Blends with glassmorphism effects</li>
            <li><strong>Hover Effect:</strong> Subtle white/10 background on hover</li>
            <li><strong>Customizable Size:</strong> Accepts size prop for width/height</li>
            <li><strong>Customizable Color:</strong> Accepts color prop for icon color</li>
            <li><strong>Fully Rounded:</strong> Uses button radius token</li>
        </ul>
    </div>
</div>

