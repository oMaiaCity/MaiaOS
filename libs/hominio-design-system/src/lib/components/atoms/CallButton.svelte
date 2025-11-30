<script>
	import Icon from '@iconify/svelte';
	import { css, cx } from 'styled-system/css';

	export let state = 'inactive'; // 'inactive' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'active'
	export let onClick = () => {};

	// Backward compatibility: support isActive prop
	export let isActive = undefined;
	$: if (isActive !== undefined) {
		state = isActive ? 'active' : 'inactive';
	}

	const baseStyle = css({
		rounded: 'full',
		w: '20',
		h: '20',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'all 300ms',
		boxShadow: 'lg',
		mx: '2',
		my: '-2',
		borderWidth: '2px',
		borderColor: 'white/20',
		color: 'white',
		cursor: 'pointer',
		zIndex: '10',
		_hover: { transform: 'scale(1.05)' },
		_active: { transform: 'scale(0.95)' }
	});

	const stateStyles = {
		inactive: css({
			bg: 'secondary.500',
			boxShadow: '0 0 20px rgba(45,166,180,0.6)'
		}),
		connecting: css({
			bg: 'warning.500',
			boxShadow: '0 0 20px rgba(222,172,91,0.6)'
		}),
		listening: css({
			bg: 'secondary.500',
			boxShadow: '0 0 20px rgba(45,166,180,0.6)'
		}),
		speaking: css({
			bg: 'accent.500',
			boxShadow: '0 0 20px rgba(244,208,63,0.6)'
		}),
		thinking: css({
			bg: 'success.500',
			boxShadow: '0 0 20px rgba(170,196,120,0.6)'
		}),
		active: css({
			bg: 'alert.500',
			boxShadow: '0 0 20px rgba(201,119,105,0.6)'
		})
	};

	const getIcon = (currentState) => {
		switch (currentState) {
			case 'active':
				return 'lucide:mic-off';
			case 'connecting':
				return 'lucide:mic';
			case 'listening':
				return 'lucide:mic';
			case 'speaking':
				return 'lucide:mic';
			case 'thinking':
				return 'lucide:mic';
			default:
				return 'lucide:mic';
		}
	};

	const getIconColor = (currentState) => {
		switch (currentState) {
			case 'inactive':
				return 'secondary.800'; // Darker shade of secondary.500
			case 'connecting':
				return 'warning.800'; // Darker shade of warning.500
			case 'listening':
				return 'secondary.800'; // Darker shade of secondary.500
			case 'speaking':
				return 'accent.800'; // Darker shade of accent.500
			case 'thinking':
				return 'success.800'; // Darker shade of success.500
			case 'active':
				return 'alert.800'; // Darker shade of alert.500
			default:
				return 'secondary.800';
		}
	};

	const getAriaLabel = (currentState) => {
		switch (currentState) {
			case 'active':
				return 'End Call';
			case 'connecting':
				return 'Connecting';
			case 'listening':
				return 'Listening';
			case 'speaking':
				return 'Speaking';
			case 'thinking':
				return 'Thinking';
			default:
				return 'Start Call';
		}
	};
</script>

<!-- 
    Call Button Atom
    - Fully rounded circle (rounded-full aspect-square)
    - Multiple states: inactive, connecting, listening, speaking, thinking, active
    - Color-coded by state with glow shadow effect
-->
<button 
    class={cx(baseStyle, stateStyles[state])}
    on:click={onClick}
    aria-label={getAriaLabel(state)}
>
	<div class={css({ fontSize: '4xl', color: getIconColor(state) })}>
		<Icon icon={getIcon(state)} />
	</div>
</button>
