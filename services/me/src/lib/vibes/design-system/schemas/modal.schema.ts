/**
 * Modal Composite Schema Definition
 * Reusable modal component with close button, title, and content slots
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const modalSchemaDefinition: any = {
	type: 'Composite',
	name: 'design-system.modal',
	definition: {
		container: {
			layout: 'content',
			class: 'relative w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto',
		},
		children: [
			{
				slot: 'closeButton',
				leaf: {
					'@schema': 'design-system.modalCloseButton',
					parameters: {
						event: '{{closeEvent}}',
					},
				},
			},
			{
				slot: 'title',
				leafId: '{{titleLeafId}}',
			},
			{
				slot: 'content',
				leafId: '{{contentLeafId}}',
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			closeEvent: {
				type: 'string',
				description: 'Event name to trigger on close button click',
				default: 'CLOSE_MODAL',
			},
			titleLeafId: {
				type: 'string',
				description: 'Leaf ID for modal title (e.g., "todo.leaf.modalTitle")',
			},
			contentLeafId: {
				type: 'string',
				description: 'Leaf ID for modal content (e.g., "todo.leaf.modalContent")',
			},
		},
		required: ['titleLeafId', 'contentLeafId'],
		additionalProperties: false,
	},
}

