<script>
    import { css } from 'styled-system/css';
    import CallButton from '$lib/components/leafs/CallButton.svelte';
    import Label from '$lib/components/leafs/Label.svelte';
    import PreviewBackground from '$lib/components/leafs/PreviewBackground.svelte';

    let isActive = false;
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Call Button</h1>
        <p>Primary call action button with active/inactive states.</p>
    </div>

    <!-- Demo Container -->
    <div class={css({ 
        position: 'relative', 
        h: '500px', 
        w: 'full', 
        bg: 'slate.300', 
        rounded: 'xl', 
        overflow: 'hidden', 
        borderWidth: '1px', 
        borderColor: 'slate.200', 
        shadow: 'inner', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '8'
    })}>
        <!-- Background Pattern -->
        <PreviewBackground opacity="0.5" />
        
        <!-- Inactive and Active States -->
        <div class={css({ display: 'flex', gap: '12', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: '10' })}>
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <CallButton state="inactive" onClick={() => {}} />
                <Label>Inactive</Label>
            </div>
            
            <div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
                <CallButton state="active" onClick={() => {}} />
                <Label>Active</Label>
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
            The Call Button is a fully rounded circular button with multiple states for different call phases.
        </p>
        
        <h3>States</h3>
        <ul>
            <li><strong>Inactive:</strong> Accent 500 (Yellow/Orange) - Ready to start call, icon color: accent.900</li>
            <li><strong>Active:</strong> Alert 500 (Red) - Call active, end call, icon color: alert.900</li>
        </ul>
        
        <h3>Features</h3>
        <ul>
            <li><strong>Size:</strong> 20x20 (w-20 h-20)</li>
            <li><strong>Icon:</strong> Lucide mic icon (inactive state) / Lucide x icon (active state)</li>
            <li><strong>Glow Effect:</strong> Box shadow with color-matched glow for each state</li>
            <li><strong>Overlap:</strong> Uses negative margin (my: -2) to overlap NavPill edges</li>
            <li><strong>Backward Compatible:</strong> Still supports <code>isActive</code> prop for legacy usage</li>
        </ul>
    </div>
</div>

