/**
 * Wellness Store
 * In-memory Svelte store for wellness services
 * Resets on page refresh (no persistence)
 */

import { writable } from 'svelte/store'

/**
 * Wellness service structure
 * @typedef {Object} WellnessService
 * @property {number} id - Unique identifier
 * @property {string} name - Service name
 * @property {string} description - Service description
 * @property {number} price - Price in EUR
 * @property {string} [duration] - Duration (e.g., "60 Minuten", "Tageszugang")
 */

/**
 * Wellness data structure
 * @typedef {Object} WellnessData
 * @property {WellnessService[]} massages - Massage services
 * @property {WellnessService[]} treatments - Treatment services
 * @property {WellnessService[]} packages - Package services
 * @property {WellnessService[]} facilities - Facility services
 */

/**
 * Wellness configuration
 * @typedef {Object} WellnessConfig
 * @property {string[]} [instructions] - Instructions for AI
 * @property {string} [reminder] - Reminder text
 * @property {Object<string, string>} [categoryNames] - Category name mappings
 * @property {Object} [currency] - Currency configuration
 */

// Seed data (hardcoded for now, will be replaced with dynamic loading later)
const SEED_WELLNESS_DATA = {
	massages: [
		{
			id: 1,
			name: 'Klassische Massage',
			description: 'Entspannende Ganzkörpermassage mit warmen Ölen',
			price: 85.0,
			duration: '60 Minuten',
		},
		{
			id: 2,
			name: 'Hot Stone Massage',
			description: 'Tiefenentspannung mit erwärmten Steinen',
			price: 120.0,
			duration: '75 Minuten',
		},
		{
			id: 3,
			name: 'Aromatherapie Massage',
			description: 'Massage mit ätherischen Ölen für Körper und Geist',
			price: 95.0,
			duration: '60 Minuten',
		},
		{
			id: 4,
			name: 'Sportmassage',
			description: 'Intensive Massage zur Lockerung der Muskulatur',
			price: 90.0,
			duration: '45 Minuten',
		},
	],
	treatments: [
		{
			id: 5,
			name: 'Gesichtsbehandlung',
			description: 'Verjüngende Gesichtsbehandlung mit natürlichen Produkten',
			price: 110.0,
			duration: '75 Minuten',
		},
		{
			id: 6,
			name: 'Körperpeeling',
			description: 'Exfolierende Behandlung für glatte Haut',
			price: 75.0,
			duration: '45 Minuten',
		},
		{
			id: 7,
			name: 'Wraps & Packungen',
			description: 'Entgiftende Körperpackung mit Algen oder Schlamm',
			price: 95.0,
			duration: '60 Minuten',
		},
		{
			id: 8,
			name: 'Maniküre & Pediküre',
			description: 'Professionelle Nagelpflege für Hände und Füße',
			price: 65.0,
			duration: '60 Minuten',
		},
	],
	packages: [
		{
			id: 9,
			name: 'Wellness-Tag',
			description: 'Massage, Gesichtsbehandlung, Zugang zu Sauna und Dampfbad',
			price: 220.0,
			duration: '4 Stunden',
		},
		{
			id: 10,
			name: 'Entspannungspaket',
			description: 'Klassische Massage und Aromatherapie',
			price: 160.0,
			duration: '2 Stunden',
		},
		{
			id: 11,
			name: 'Verwöhnpaket',
			description: 'Hot Stone Massage, Gesichtsbehandlung und Maniküre',
			price: 280.0,
			duration: '3.5 Stunden',
		},
	],
	facilities: [
		{
			id: 12,
			name: 'Sauna',
			description: 'Finnische Sauna mit Aufguss',
			price: 25.0,
			duration: 'Tageszugang',
		},
		{
			id: 13,
			name: 'Dampfbad',
			description: 'Entspannendes Dampfbad mit Aromatherapie',
			price: 20.0,
			duration: 'Tageszugang',
		},
		{
			id: 14,
			name: 'Whirlpool',
			description: 'Entspannung im beheizten Whirlpool',
			price: 30.0,
			duration: '60 Minuten',
		},
		{
			id: 15,
			name: 'Fitnessstudio',
			description: 'Zugang zum Hotel-Fitnessstudio',
			price: 15.0,
			duration: 'Tageszugang',
		},
	],
}

// Minimal default configuration (formatter function has its own defaults)
const DEFAULT_WELLNESS_CONFIG = {}

/**
 * Wellness data store
 * @type {import('svelte/store').Writable<WellnessData>}
 */
export const wellnessData = writable(SEED_WELLNESS_DATA)

/**
 * Wellness configuration store
 * @type {import('svelte/store').Writable<WellnessConfig>}
 */
export const wellnessConfig = writable(DEFAULT_WELLNESS_CONFIG)

/**
 * Get all wellness data
 * @returns {Promise<WellnessData>}
 */
export async function getWellnessData() {
	return new Promise((resolve) => {
		wellnessData.subscribe((data) => {
			resolve({ ...data })
		})()
	})
}

/**
 * Get wellness configuration
 * @returns {Promise<WellnessConfig>}
 */
export async function getWellnessConfig() {
	return new Promise((resolve) => {
		wellnessConfig.subscribe((config) => {
			resolve({ ...config })
		})()
	})
}

/**
 * Get wellness services by category
 * @param {string} category - Category name (massages, treatments, packages, facilities)
 * @returns {Promise<WellnessService[]>}
 */
export async function getWellnessServicesByCategory(category) {
	return new Promise((resolve) => {
		wellnessData.subscribe((data) => {
			resolve([...(data[category] || [])])
		})()
	})
}

/**
 * Get wellness context string for AI
 * NOTE: This function is deprecated. Use getWellnessContextString from show-wellness.js directly with contextConfig.
 * @deprecated Use getWellnessContextString from show-wellness.js with contextConfig from skill config
 * @returns {Promise<string>}
 */
export async function getWellnessContextString() {
	throw new Error(
		'getWellnessContextString from wellness-store.js is deprecated. Use getWellnessContextString from show-wellness.js with contextConfig from skill config.',
	)
}
