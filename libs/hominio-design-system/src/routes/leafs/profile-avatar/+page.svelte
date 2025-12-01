<script>
    import { css } from 'styled-system/css';
    import ProfileAvatar from '$lib/components/leafs/ProfileAvatar.svelte';
    import Label from '$lib/components/leafs/Label.svelte';
    import PreviewBackground from '$lib/components/leafs/PreviewBackground.svelte';
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Profile Avatar</h1>
        <p>Circular avatar component with gradient background and initials.</p>
    </div>

    <!-- Demo Container -->
    <div class={css({ 
        position: 'relative', 
        h: '400px', 
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
        gap: '8',
        flexWrap: 'wrap'
    })}>
        <!-- Background Pattern -->
        <PreviewBackground opacity="0.5" />
        
        <!-- Various Examples -->
        <div class={css({ display: 'flex', gap: '8', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: '10' })}>
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <div class={css({ w: '11', h: '11' })}>
                    <ProfileAvatar initials="SA" />
                </div>
                <Label>SA</Label>
            </div>
            
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <div class={css({ w: '11', h: '11' })}>
                    <ProfileAvatar initials="JD" />
                </div>
                <Label>JD</Label>
            </div>
            
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <div class={css({ w: '11', h: '11' })}>
                    <ProfileAvatar initials="AB" />
                </div>
                <Label>AB</Label>
            </div>
        </div>
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
            Profile Avatar displays user initials in a circular container with a gradient background.
        </p>
        
        <h3>Features</h3>
        <ul>
            <li><strong>Fully Rounded:</strong> Perfect circle using rounded-full</li>
            <li><strong>Gradient Background:</strong> Primary 800 to Primary 600 gradient</li>
            <li><strong>Initials Display:</strong> Shows provided initials prop</li>
            <li><strong>Glass Border:</strong> Subtle white/20 border</li>
            <li><strong>Responsive Size:</strong> Adapts to parent container size</li>
        </ul>
    </div>
</div>

