/**
 * Wallet Skills - Independent skill functions for wallet operations
 * Each skill is self-contained and can be called independently
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'

// ========== SKILL IMPLEMENTATIONS ==========

const openSendModalSkill: Skill = {
	metadata: {
		id: '@wallet/openSendModal',
		name: 'Open Send Modal',
		description: 'Opens the send money modal',
		category: 'wallet',
	},
	execute: (data: Data) => {
		data.showSendModal = true
		data.selectedRecipient = null
		data.sendAmount = ''
		data.sendDescription = ''
		data.error = null
	},
}

const closeSendModalSkill: Skill = {
	metadata: {
		id: '@wallet/closeSendModal',
		name: 'Close Send Modal',
		description: 'Closes the send money modal',
		category: 'wallet',
	},
	execute: (data: Data) => {
		data.showSendModal = false
		data.selectedRecipient = null
		data.sendAmount = ''
		data.sendDescription = ''
		data.error = null
	},
}

const selectRecipientSkill: Skill = {
	metadata: {
		id: '@wallet/selectRecipient',
		name: 'Select Recipient',
		description: 'Selects a recipient for money transfer',
		category: 'wallet',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the recipient',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const { id } = (payload as { id?: string }) || {}
		if (!id) return

		const recipients = (data.recipients as Array<{ id: string }>) || []
		const recipient = recipients.find((r) => r.id === id)
		if (recipient) {
			data.selectedRecipient = recipient
		}
	},
}

const updateSendAmountSkill: Skill = {
	metadata: {
		id: '@wallet/updateSendAmount',
		name: 'Update Send Amount',
		description: 'Updates the send amount input',
		category: 'wallet',
		parameters: {
			type: 'object',
			properties: {
				amount: {
					type: 'string',
					description: 'The amount to send',
					required: true,
				},
			},
			required: ['amount'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const { amount } = (payload as { amount?: string }) || {}
		if (amount !== undefined) {
			data.sendAmount = amount
		}
	},
}

const updateSendDescriptionSkill: Skill = {
	metadata: {
		id: '@wallet/updateSendDescription',
		name: 'Update Send Description',
		description: 'Updates the send description input',
		category: 'wallet',
		parameters: {
			type: 'object',
			properties: {
				description: {
					type: 'string',
					description: 'The description for the transaction',
					required: true,
				},
			},
			required: ['description'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const { description } = (payload as { description?: string }) || {}
		if (description !== undefined) {
			data.sendDescription = description
		}
	},
}

const validateSendSkill: Skill = {
	metadata: {
		id: '@wallet/validateSend',
		name: 'Validate Send',
		description: 'Validates the send money form',
		category: 'wallet',
	},
	execute: (data: Data) => {
		const amount = parseFloat(data.sendAmount as string)
		const balance = data.balance as number

		if (!data.selectedRecipient) {
			data.error = 'Please select a recipient'
			return
		}

		if (!data.sendAmount || Number.isNaN(amount) || amount <= 0) {
			data.error = 'Please enter a valid amount'
			return
		}

		if (amount > balance) {
			data.error = 'Insufficient balance'
			return
		}

		data.error = null
	},
}

const sendMoneySkill: Skill = {
	metadata: {
		id: '@wallet/sendMoney',
		name: 'Send Money',
		description: 'Sends money to the selected recipient',
		category: 'wallet',
	},
	execute: (data: Data) => {
		const amount = parseFloat(data.sendAmount as string)
		const balance = data.balance as number
		const selectedRecipient = data.selectedRecipient as { id: string; name: string } | null

		if (!selectedRecipient || !amount || amount <= 0 || amount > balance) {
			return // Validation should have caught this
		}

		// Update balance
		data.balance = balance - amount

		// Add transaction - format matches existing transactions
		const transactions = (data.transactions as Array<unknown>) || []
		const description =
			(data.sendDescription as string)?.trim() || `Transfer to ${selectedRecipient.name}`
		const newTransaction = {
			id: `txn-${Date.now()}`,
			type: 'expense',
			amount: Math.round(amount * 100) / 100, // Round to 2 decimals
			category: 'Transfer',
			categoryIcon: 'solar:wallet-money-bold-duotone',
			categoryColor: '#001a42',
			description: description,
			date: new Date().toISOString(),
		}

		// Add to beginning of array (newest first)
		data.transactions = [newTransaction, ...transactions]

		// Reset form
		data.selectedRecipient = null
		data.sendAmount = ''
		data.sendDescription = ''
	},
}

// ========== SKILL EXPORTS ==========

/**
 * All wallet-related skills
 */
export const walletSkills: Record<string, Skill> = {
	'@wallet/openSendModal': openSendModalSkill,
	'@wallet/closeSendModal': closeSendModalSkill,
	'@wallet/selectRecipient': selectRecipientSkill,
	'@wallet/updateSendAmount': updateSendAmountSkill,
	'@wallet/updateSendDescription': updateSendDescriptionSkill,
	'@wallet/validateSend': validateSendSkill,
	'@wallet/sendMoney': sendMoneySkill,
}
