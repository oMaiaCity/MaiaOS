<script>
	import Icon from '@iconify/svelte';
	import { css, cx } from 'styled-system/css';

	export let state = 'inactive'; // 'inactive' | 'active'
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
		active: css({
			bg: 'accent.500',
			boxShadow: '0 0 20px rgba(238, 206, 91, 0.6)'
		})
	};

	const getIcon = (currentState) => {
		switch (currentState) {
			case 'active':
				return 'lucide:mic-off';
			default:
				return 'lucide:mic';
		}
	};

	const getIconColor = (currentState) => {
		switch (currentState) {
			case 'inactive':
				return 'secondary.900'; // Darker shade of secondary.500
			case 'active':
				return 'accent.900'; // Dark shade for active state (accent.900) on yellow
			default:
				return 'primary.800';
		}
	};

	const getAriaLabel = (currentState) => {
		switch (currentState) {
			case 'active':
				return 'End Call';
			default:
				return 'Start Call';
		}
	};

	// Icon wrapper style
	const iconWrapperStyle = css({ 
		fontSize: '4xl', 
		display: 'flex', 
		alignItems: 'center', 
		justifyContent: 'center'
	});

	// Static icon color styles - Panda CSS needs to see these statically
	const iconColorStyles = {
		inactive: css({ 
			color: 'secondary.900',
			'& svg': {
				color: 'secondary.900',
				fill: 'currentColor',
				stroke: 'currentColor'
			}
		}),
		active: css({ 
			color: 'accent.900',
			'& svg': {
				color: 'accent.900',
				fill: 'currentColor',
				stroke: 'currentColor'
			}
		})
	};
</script>

<!-- 
    Call Button Atom
    - Fully rounded circle (rounded-full aspect-square)
    - Two states: inactive, active
    - Color-coded by state with glow shadow effect
-->
<button 
    class={cx(baseStyle, stateStyles[state])}
    on:click={onClick}
    aria-label={getAriaLabel(state)}
>
	<div class={iconWrapperStyle}>
		<Icon icon={getIcon(state)} class={iconColorStyles[state]} />
	</div>
</button>
