<script>
	import Icon from '@iconify/svelte';
	import { css, cx } from 'styled-system/css';
	import GlassIconButton from '../leafs/GlassIconButton.svelte';
	import CallButton from '../leafs/CallButton.svelte';
	import ProfileAvatar from '../leafs/ProfileAvatar.svelte';

	// Svelte 5 Runes
	let {
		isFixed = true,
		...rest
	} = $props();

	let isCallActive = $state(false);

	function toggleCall() {
		isCallActive = !isCallActive;
	}

	const glassPillBase = css({
		display: 'flex',
		alignItems: 'center',
		gap: '1',
		rounded: 'full',
		border: '1px solid token(colors.white/60)',
		bg: 'white/40',
		px: '4',
		py: '-0.5',
		boxShadow: '0 8px 30px rgb(0,0,0,0.08)',
		backdropFilter: 'blur(24px)'
	});

	const glassPillNav = css({
		position: 'fixed',
		bottom: 'max(env(safe-area-inset-bottom), 1rem)',
		left: '50%',
		zIndex: '1000',
		transform: 'translateX(-50%)'
	});

	// Override styles for the dark theme
	const darkThemeOverride = css({
		bg: 'primary.700 !important',
		borderColor: 'primary.600/30 !important',
		boxShadow: '2xl !important',
		backdropFilter: 'blur(64px) !important'
	});
</script>

<!-- 
	NavPill Composition
    - Uses glass-pill-nav logic (fixed positioning)
    - Or glass-pill-base + generic styling if isFixed=false
	- Overriding default light background with dark Primary 700
-->
<div class={cx(glassPillBase, isFixed && glassPillNav, darkThemeOverride)} {...rest}>
	<!-- Left: Notifications -->
	<GlassIconButton label="Notifications" size={css({ w: '11', h: '11' })}>
		<div class={css({ fontSize: 'xl', color: 'primary.100' })}>
			<Icon icon="lucide:bell" />
		</div>
	</GlassIconButton>

	<!-- Center: Call Action (Main Button) - Larger and overlapping -->
	<CallButton isActive={isCallActive} onClick={toggleCall} />

	<!-- Right: Profile -->
	<GlassIconButton label="Profile" size={css({ w: '11', h: '11' })}>
		<ProfileAvatar />
	</GlassIconButton>
</div>
