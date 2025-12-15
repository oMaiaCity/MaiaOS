/**
 * Shared Root Card Composite Configuration
 * Reusable card container with responsive padding/margin for all vibes
 */

import type { CompositeConfig } from '../../compositor/view/types'

/**
 * Creates a root composite with responsive margin/padding
 * The outer container has responsive margin (moves padding from page level)
 * The inner card has responsive padding
 * 
 * @param children - The children to place inside the card
 * @param cardLayout - Layout for the card container ('grid' or 'flex'), defaults to 'grid'
 * @param cardClasses - Additional classes for the card container
 * @param id - Optional unique identifier for this composite config
 */
export function createRootCard(
	children: CompositeConfig['children'],
	cardLayout: 'grid' | 'flex' = 'grid',
	cardClasses: string = '',
	id?: string
): CompositeConfig {
	const outerLayout = cardLayout === 'flex' ? 'flex' : 'grid'
	const outerClasses = cardLayout === 'flex' 
		? 'max-w-6xl mx-auto flex-col p-2 @xs:p-3 @sm:p-4 @md:p-6'
		: 'max-w-6xl mx-auto grid-cols-1 p-2 @xs:p-3 @sm:p-4 @md:p-6'
	
	const innerCardClasses = cardLayout === 'flex'
		? 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-grow flex-shrink flex-basis-0 min-h-0 flex-col'
		: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 grid-cols-1 grid-rows-[auto_auto_1fr]'
	
	return {
		...(id && { id }),
		container: {
			layout: outerLayout,
			class: outerClasses,
		},
		children: [
			{
				slot: 'cardContainer',
				composite: {
					container: {
						layout: cardLayout,
						class: cardClasses ? `${innerCardClasses} ${cardClasses}` : innerCardClasses,
					},
					children,
				},
			},
		],
	}
}



