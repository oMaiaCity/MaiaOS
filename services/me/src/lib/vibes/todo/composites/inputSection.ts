/**
 * Input Section Composite Configuration
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { errorLeaf, inputFormLeaf } from '../leafs'

export const inputSectionComposite: CompositeConfig = {
	type: 'stack',
	container: {
		class: 'pt-6 bg-slate-50',
	},
	children: [
		{
			slot: 'input.value',
			leaf: {
				...inputFormLeaf,
				classes: inputFormLeaf.classes ? `${inputFormLeaf.classes} h-auto` : 'h-auto',
			},
		},
		{
			slot: 'error',
			leaf: {
				...errorLeaf,
				classes: errorLeaf.classes ? `${errorLeaf.classes} h-auto` : 'h-auto',
			},
		},
	],
}
