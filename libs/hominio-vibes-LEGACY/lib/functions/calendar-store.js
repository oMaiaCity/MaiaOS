/**
 * Calendar Store
 * In-memory Svelte store for calendar entries
 * Resets on page refresh (no persistence)
 */

import { writable } from 'svelte/store'

/**
 * Calendar entry structure
 * @typedef {Object} CalendarEntry
 * @property {string} id - Unique identifier
 * @property {string} title - Entry title
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {string} time - Time string (HH:MM)
 * @property {number} duration - Duration in minutes
 * @property {string} [description] - Optional description
 */

/**
 * Generate unique ID for calendar entry
 * @returns {string}
 */
function generateId() {
	return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calendar entries store
 * @type {import('svelte/store').Writable<CalendarEntry[]>}
 */
export const calendarEntries = writable([])

/**
 * Get all calendar entries
 * @returns {Promise<CalendarEntry[]>}
 */
export async function getEntries() {
	return new Promise((resolve) => {
		calendarEntries.subscribe((entries) => {
			resolve([...entries])
		})()
	})
}

/**
 * Add a new calendar entry
 * @param {Omit<CalendarEntry, 'id'>} entryData - Entry data without ID
 * @returns {Promise<CalendarEntry>}
 */
export async function addEntry(entryData) {
	return new Promise((resolve) => {
		calendarEntries.update((entries) => {
			const newEntry = {
				id: generateId(),
				...entryData,
			}
			const updated = [...entries, newEntry]
			resolve(newEntry)
			return updated
		})
	})
}

/**
 * Update an existing calendar entry
 * @param {string} id - Entry ID
 * @param {Partial<Omit<CalendarEntry, 'id'>>} updates - Fields to update
 * @returns {Promise<CalendarEntry | null>}
 */
export async function updateEntry(id, updates) {
	return new Promise((resolve) => {
		calendarEntries.update((entries) => {
			const index = entries.findIndex((e) => e.id === id)
			if (index === -1) {
				resolve(null)
				return entries
			}
			const updated = [...entries]
			updated[index] = { ...updated[index], ...updates }
			resolve(updated[index])
			return updated
		})
	})
}

/**
 * Delete a calendar entry
 * @param {string} id - Entry ID
 * @returns {Promise<boolean>}
 */
export async function deleteEntry(id) {
	return new Promise((resolve) => {
		calendarEntries.update((entries) => {
			const index = entries.findIndex((e) => e.id === id)
			if (index === -1) {
				resolve(false)
				return entries
			}
			const updated = entries.filter((e) => e.id !== id)
			resolve(true)
			return updated
		})
	})
}

/**
 * Get entries for a specific week (starting from a given date, 7 days)
 * @param {string} [startDate] - Start date (YYYY-MM-DD), defaults to today
 * @returns {Promise<CalendarEntry[]>}
 */
export async function getWeekEntries(startDate) {
	return new Promise((resolve) => {
		calendarEntries.subscribe((entries) => {
			const start = startDate ? new Date(startDate) : new Date()
			start.setHours(0, 0, 0, 0)

			const end = new Date(start)
			end.setDate(end.getDate() + 7)

			const weekEntries = entries.filter((entry) => {
				const entryDate = new Date(entry.date)
				entryDate.setHours(0, 0, 0, 0)
				return entryDate >= start && entryDate < end
			})

			// Sort by date, then by time
			weekEntries.sort((a, b) => {
				const dateCompare = a.date.localeCompare(b.date)
				if (dateCompare !== 0) return dateCompare
				return a.time.localeCompare(b.time)
			})

			resolve(weekEntries)
		})()
	})
}

/**
 * Get entry by ID
 * @param {string} id - Entry ID
 * @returns {Promise<CalendarEntry | null>}
 */
export async function getEntryById(id) {
	return new Promise((resolve) => {
		calendarEntries.subscribe((entries) => {
			const entry = entries.find((e) => e.id === id)
			resolve(entry || null)
		})()
	})
}

/**
 * Get calendar state as context string for AI
 * @returns {Promise<string>}
 */
export async function getCalendarContextString() {
	const entries = await getEntries()

	// Get current date in YYYY-MM-DD format
	const now = new Date()
	const currentDate = now.toISOString().split('T')[0]
	const currentDateFormatted = now.toLocaleDateString('de-DE', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
	const currentTime = now.toLocaleTimeString('de-DE', {
		hour: '2-digit',
		minute: '2-digit',
	})

	const lines = [
		`AKTUELLES DATUM UND ZEIT:`,
		`- Datum: ${currentDateFormatted} (${currentDate})`,
		`- Uhrzeit: ${currentTime}`,
		'',
		'Aktueller Kalenderzustand:',
		'',
		`Gesamt: ${entries.length} ${entries.length === 1 ? 'Termin' : 'Termine'}`,
		'',
		'Termine:',
	]

	entries.forEach((entry) => {
		const date = new Date(entry.date).toLocaleDateString('de-DE', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
		const endTime = calculateEndTime(entry.time, entry.duration)
		lines.push(
			`- ID: ${entry.id}`,
			`  Titel: ${entry.title}`,
			`  Datum: ${date} (${entry.date})`,
			`  Zeit: ${entry.time} - ${endTime} (Dauer: ${entry.duration} Minuten)`,
			entry.description ? `  Beschreibung: ${entry.description}` : '',
			'',
		)
	})

	return lines.join('\n')
}

/**
 * Calculate end time from start time and duration
 * @param {string} startTime - Start time (HH:MM)
 * @param {number} duration - Duration in minutes
 * @returns {string} End time (HH:MM)
 */
function calculateEndTime(startTime, duration) {
	const [hours, minutes] = startTime.split(':').map(Number)
	const startMinutes = hours * 60 + minutes
	const endMinutes = startMinutes + duration
	const endHours = Math.floor(endMinutes / 60) % 24
	const endMins = endMinutes % 60
	return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
}
