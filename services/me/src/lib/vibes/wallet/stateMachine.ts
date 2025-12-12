/**
 * Wallet Vibe State Machine Configuration
 * Defines all states, transitions, and initial data
 */

import type { StateMachineConfig } from '../../compositor/dataStore'

// Generate random transactions
const generateTransactions = () => {
	const categories = [
		{ name: 'Groceries', icon: 'solar:cart-large-3-bold-duotone', color: '#001a42' },
		{ name: 'Restaurant', icon: 'solar:chef-hat-heart-line-duotone', color: '#001a42' },
		{ name: 'Transport', icon: 'solar:bus-line-duotone', color: '#001a42' },
		{ name: 'Shopping', icon: 'solar:bag-heart-bold-duotone', color: '#001a42' },
		{ name: 'Salary', icon: 'solar:wallet-money-bold-duotone', color: '#001a42' },
		{ name: 'Freelance', icon: 'solar:case-bold-duotone', color: '#001a42' },
		{ name: 'Utilities', icon: 'solar:station-bold-duotone', color: '#001a42' },
		{ name: 'Entertainment', icon: 'solar:gamepad-bold-duotone', color: '#001a42' },
	]

	const transactions = []
	const now = Date.now()

	for (let i = 0; i < 15; i++) {
		const isIncome = Math.random() > 0.6 // 40% income, 60% expense
		const category = categories[Math.floor(Math.random() * categories.length)]
		const amount = Math.random() * (isIncome ? 2000 : 500) + (isIncome ? 100 : 10)
		const daysAgo = Math.floor(Math.random() * 30)
		const date = new Date(now - daysAgo * 24 * 60 * 60 * 1000)

		transactions.push({
			id: `txn-${i + 1}`,
			type: isIncome ? 'income' : 'expense',
			amount: Math.round(amount * 100) / 100, // Round to 2 decimals
			category: category.name,
			categoryIcon: category.icon,
			categoryColor: category.color,
			description: isIncome
				? `Payment from ${['Client A', 'Client B', 'Employer', 'Freelance Work'][Math.floor(Math.random() * 4)]}`
				: `Payment to ${['Supermarket', 'Restaurant', 'Uber', 'Amazon', 'Netflix'][Math.floor(Math.random() * 5)]}`,
			date: date.toISOString(),
		})
	}

	// Sort by date (newest first)
	return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Generate random recipients
const generateRecipients = () => {
	const names = ['Alice Schmidt', 'Bob Müller', 'Clara Weber', 'David Fischer', 'Emma Wagner']
	return names.map((name, index) => ({
		id: `recipient-${index + 1}`,
		name,
		iban: `DE89 3704 0044 0532 0130 ${String(index + 1).padStart(2, '0')}`,
	}))
}

export const walletStateMachine: StateMachineConfig = {
	initial: 'idle',
	data: {
		balance: 5423.87,
		currency: '€',
		transactions: generateTransactions(),
		recipients: generateRecipients(),
		showSendModal: false,
		selectedRecipient: null,
		sendAmount: '',
		sendDescription: '',
		error: null,
	},
	states: {
		idle: {
			on: {
				OPEN_SEND_MODAL: {
					target: 'idle',
					actions: ['@wallet/openSendModal'],
				},
				CLOSE_SEND_MODAL: {
					target: 'idle',
					actions: ['@wallet/closeSendModal'],
				},
				SELECT_RECIPIENT: {
					target: 'idle',
					actions: ['@wallet/selectRecipient'],
				},
				UPDATE_SEND_AMOUNT: {
					target: 'idle',
					actions: ['@wallet/updateSendAmount'],
				},
				UPDATE_SEND_DESCRIPTION: {
					target: 'idle',
					actions: ['@wallet/updateSendDescription'],
				},
				SEND_MONEY: {
					target: 'idle',
					actions: ['@wallet/validateSend', '@wallet/sendMoney', '@wallet/closeSendModal'],
				},
			},
		},
	},
	actions: {},
}
