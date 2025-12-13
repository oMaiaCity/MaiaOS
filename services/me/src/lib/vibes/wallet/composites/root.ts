/**
 * Root Composite Configuration
 * Main container for the wallet interface
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { backdropLeaf } from '../leafs'
import { balanceComposite } from './balance'
import { footerComposite } from './footer'
import { transactionListComposite } from './transactionList'

export const rootComposite: CompositeConfig = {
	type: 'stack',
	container: {
		class: 'h-full w-full max-w-6xl mx-auto flex flex-col',
		padding: '1.5rem 1.5rem',
	},
	children: [
		{
			slot: 'cardContainer',
			flex: {
				grow: 1,
				shrink: 1,
				basis: '0',
			},
			composite: {
				type: 'stack',
				container: {
					class: 'card h-full relative p-6',
				},
				overflow: 'hidden',
				children: [
					// Balance section
					{
						slot: 'balance',
						composite: balanceComposite,
					},
					// Transaction list section
					{
						slot: 'transactions',
						flex: {
							grow: 1,
							shrink: 1,
							basis: '0',
						},
						overflow: 'auto',
						composite: transactionListComposite,
					},
					// Footer with send button
					{
						slot: 'footer',
						flex: {
							grow: 0,
							shrink: 0,
						},
						composite: footerComposite,
					},
					// Backdrop blur overlay when form is open
					{
						slot: 'backdrop',
						position: {
							type: 'absolute',
							top: '0',
							left: '0',
							right: '0',
							bottom: '0',
							zIndex: 1,
						},
						leaf: backdropLeaf,
					},
				],
			},
		},
	],
}
