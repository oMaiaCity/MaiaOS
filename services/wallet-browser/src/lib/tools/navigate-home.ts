/**
 * navigateHome Tool Handler
 * Opens localhost:4200 in a new tab
 */

export interface ToolResult {
	success: boolean
	result: any
	contextString?: string
	error?: string
}

export const navigateHomeToolSchema = {
	name: 'navigateHome',
	description:
		'Navigate to the home page (localhost:4200). Opens the Hominio home page in a new browser tab.',
	parameters: {
		type: 'object',
		properties: {},
		required: [],
	},
}

export async function handleNavigateHome(): Promise<ToolResult> {
	try {
		// Open localhost:4200 in a new tab
		const tab = await browser.tabs.create({
			url: 'http://localhost:4200',
			active: true,
		})

		return {
			success: true,
			result: {
				tabId: tab.id,
				url: 'http://localhost:4200',
			},
			contextString: 'Opened home page (localhost:4200) in a new tab',
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error'
		return {
			success: false,
			result: { error: errorMessage },
			error: errorMessage,
		}
	}
}

