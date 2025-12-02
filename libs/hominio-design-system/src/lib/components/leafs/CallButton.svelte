<script>
	import Icon from '@iconify/svelte';
	import { css, cx } from 'styled-system/css';

	// Svelte 5 Runes
	let {
		state = 'inactive',
		onClick = () => {},
		isActive,
		...rest
	} = $props();

	// Backward compatibility: support isActive prop
	let actualState = $derived(isActive !== undefined ? (isActive ? 'active' : 'inactive') : state);

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
			bg: 'accent.500',
			boxShadow: '0 0 20px rgba(255, 159, 0, 0.6)'
		}),
		active: css({
			bg: 'alert.500',
			boxShadow: '0 0 20px rgba(203, 4, 4, 0.6)'
		})
	};

	const getIcon = (currentState) => {
		switch (currentState) {
			case 'active':
				return 'lucide:x';
			default:
				return 'lucide:mic';
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
			color: 'accent.900',
			'& svg': {
				color: 'accent.900',
				fill: 'currentColor',
				stroke: 'currentColor'
			}
		}),
		active: css({ 
			color: 'alert.900',
			'& svg': {
				color: 'alert.900',
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
    class={cx(baseStyle, stateStyles[actualState])}
    onclick={onClick}
    aria-label={getAriaLabel(actualState)}
    {...rest}
>
	<div class={iconWrapperStyle}>
		<Icon icon={getIcon(actualState)} class={iconColorStyles[actualState]} />
	</div>
</button>
