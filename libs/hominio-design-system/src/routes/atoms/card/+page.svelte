<script>
    import { css } from 'styled-system/css';
    import Card from '$lib/components/atoms/Card.svelte';
    import PreviewBackground from '$lib/components/atoms/PreviewBackground.svelte';
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Card</h1>
        <p>Generic card wrapper component for content containers.</p>
    </div>

    <!-- Demo Container -->
    <div class={css({ 
        position: 'relative', 
        minH: '400px', 
        w: 'full', 
        bg: 'slate.300', 
        rounded: 'xl', 
        overflow: 'hidden', 
        borderWidth: '1px', 
        borderColor: 'slate.200', 
        shadow: 'inner', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: '8',
        gap: '6',
        flexWrap: 'wrap'
    })}>
        <!-- Background Pattern -->
        <PreviewBackground opacity="0.5" />
        
        <!-- Card Example -->
        <Card padding="8" glass={true} class={css({ maxW: 'md', position: 'relative', zIndex: '10' })}>
            <h1 class={css({ fontSize: '2xl', fontWeight: 'bold', mb: '2', textAlign: 'center' })}>Card Title</h1>
            <p class={css({ fontSize: 'sm', mb: '4', textAlign: 'center' })}>
                A brief description of the card content
            </p>
            <p class={css({ fontSize: 'base', lineHeight: 'relaxed' })}>
                This is a normal text paragraph demonstrating how content appears within the Card component. 
                The Card provides a clean container with liquid glass styling, featuring a translucent background, 
                backdrop blur, and subtle borders. It's perfect for displaying various types of content in a 
                visually appealing way.
            </p>
        </Card>
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
            Card is a flexible wrapper component for displaying content in a contained, elevated container.
        </p>
        
        <h3>Props</h3>
        <ul>
            <li><strong>padding:</strong> Padding size (default: '6')</li>
            <li><strong>rounded:</strong> Border radius token (default: 'card')</li>
            <li><strong>bg:</strong> Background color (default: 'slate.50')</li>
            <li><strong>shadow:</strong> Box shadow size (default: 'none' for liquid glass)</li>
            <li><strong>border:</strong> Show border (default: true)</li>
            <li><strong>borderColor:</strong> Border color (default: 'glass.border.default')</li>
            <li><strong>glass:</strong> Enable liquid glass effect with backdrop blur (default: true)</li>
            <li><strong>className:</strong> Additional CSS classes</li>
        </ul>
        
        <h3>Features</h3>
        <ul>
            <li><strong>Liquid Glass Effect:</strong> Translucent background with backdrop blur</li>
            <li><strong>Flexible Padding:</strong> Customizable padding via prop</li>
            <li><strong>Rounded Corners:</strong> Uses card radius token by default</li>
            <li><strong>No Shadow:</strong> Clean liquid glass aesthetic without shadow</li>
            <li><strong>Border:</strong> Subtle glass border for definition</li>
            <li><strong>Slot Content:</strong> Accepts any content via slot</li>
        </ul>
    </div>
</div>

