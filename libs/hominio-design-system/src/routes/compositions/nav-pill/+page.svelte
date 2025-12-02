<script>
	import NavPill from '$lib/components/compositions/NavPill.svelte';
    import { css } from 'styled-system/css';
    import PreviewBackground from '$lib/components/leafs/PreviewBackground.svelte';
</script>

<div class={css({ spaceY: '12' })}>
	<div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
		<h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>NavPill</h1>
		<p>The primary navigation and call control component.</p>
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
        justifyContent: 'center' 
    })}>
		<!-- Background Pattern -->
		<PreviewBackground opacity="0.5" />
		
		<!-- The Component positioned relatively within the demo container -->
		<div class={css({ position: 'relative', zIndex: '10' })}>
			<NavPill isFixed={false} />
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
			The NavPill is designed to be fixed at the bottom of the viewport. It uses <code>glass-pill-nav</code> logic for styling.
		</p>
		
		<h3>Features</h3>
		<ul>
			<li><strong>Liquid Glass Effect:</strong> Uses backdrop blur and translucent backgrounds.</li>
			<li><strong>Responsive:</strong> Adapts to safe areas on mobile devices.</li>
			<li><strong>Stateful:</strong> The call button toggles between "Start Call" and "End Call" states with appropriate visual feedback (Accent vs Alert colors).</li>
		</ul>
	</div>
</div>
