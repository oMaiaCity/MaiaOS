/**
 * Menu Store
 * In-memory Svelte store for menu items
 * Resets on page refresh (no persistence)
 */

import { writable } from 'svelte/store';

/**
 * Menu item structure
 * @typedef {Object} MenuItem
 * @property {number} id - Unique identifier
 * @property {string} name - Item name
 * @property {string} description - Item description
 * @property {number} price - Price in EUR
 * @property {string} type - Portion type (e.g., "Portion", "Glas", "Tasse")
 */

/**
 * Menu data structure
 * @typedef {Object} MenuData
 * @property {MenuItem[]} appetizers - Appetizer items
 * @property {MenuItem[]} mains - Main course items
 * @property {MenuItem[]} desserts - Dessert items
 * @property {MenuItem[]} drinks - Drink items
 */

/**
 * Menu configuration
 * @typedef {Object} MenuConfig
 * @property {string[]} [instructions] - Instructions for AI
 * @property {string} [reminder] - Reminder text
 * @property {Object<string, string>} [categoryNames] - Category name mappings
 * @property {Object} [currency] - Currency configuration
 */

// Seed data (hardcoded for now, will be replaced with dynamic loading later)
const SEED_MENU_DATA = {
	appetizers: [
		{
			id: 1,
			name: "Caesar Salat",
			description: "Frischer Römersalat mit Caesar-Dressing",
			price: 11.90,
			type: "Portion"
		},
		{
			id: 2,
			name: "Bruschetta",
			description: "Geröstetes Brot mit Tomaten und Basilikum",
			price: 9.20,
			type: "Portion"
		},
		{
			id: 3,
			name: "Tagesuppe",
			description: "Tägliche Auswahl des Küchenchefs",
			price: 8.30,
			type: "Schüssel"
		}
	],
	mains: [
		{
			id: 4,
			name: "Gegrillter Lachs",
			description: "Atlantischer Lachs mit Zitronenbuttersauce",
			price: 23.00,
			type: "Portion"
		},
		{
			id: 5,
			name: "Ribeye Steak",
			description: "340g Ribeye-Steak mit geröstetem Gemüse",
			price: 30.40,
			type: "Portion"
		},
		{
			id: 6,
			name: "Vegetarische Pasta",
			description: "Frische Pasta mit saisonalem Gemüse",
			price: 17.50,
			type: "Portion"
		},
		{
			id: 7,
			name: "Hähnchen-Risotto",
			description: "Cremiges Risotto mit gegrilltem Hähnchen",
			price: 21.20,
			type: "Portion"
		}
	],
	desserts: [
		{
			id: 8,
			name: "Schokoladen-Lava-Kuchen",
			description: "Warmer Schokoladenkuchen mit Vanilleeis",
			price: 10.10,
			type: "Portion"
		},
		{
			id: 9,
			name: "Tiramisu",
			description: "Klassisches italienisches Dessert",
			price: 9.20,
			type: "Portion"
		},
		{
			id: 10,
			name: "Käsekuchen",
			description: "New York Style Käsekuchen",
			price: 9.20,
			type: "Stück"
		}
	],
	drinks: [
		{
			id: 11,
			name: "Weinauswahl",
			description: "Hauswein rot oder weiß",
			price: 8.30,
			type: "Glas"
		},
		{
			id: 12,
			name: "Craft Beer",
			description: "Auswahl lokaler Craft-Biere",
			price: 6.40,
			type: "Flasche"
		},
		{
			id: 13,
			name: "Frischer Saft",
			description: "Orange, Apfel oder Cranberry",
			price: 4.60,
			type: "Glas"
		},
		{
			id: 14,
			name: "Kaffee & Tee",
			description: "Espresso, Cappuccino oder Teeauswahl",
			price: 3.70,
			type: "Tasse"
		}
	]
};

// Minimal default configuration (formatter function has its own defaults)
const DEFAULT_MENU_CONFIG = {};

/**
 * Menu data store
 * @type {import('svelte/store').Writable<MenuData>}
 */
export const menuData = writable(SEED_MENU_DATA);

/**
 * Menu configuration store
 * @type {import('svelte/store').Writable<MenuConfig>}
 */
export const menuConfig = writable(DEFAULT_MENU_CONFIG);

/**
 * Get all menu data
 * @returns {Promise<MenuData>}
 */
export async function getMenuData() {
	return new Promise((resolve) => {
		menuData.subscribe((data) => {
			resolve({ ...data });
		})();
	});
}

/**
 * Get menu configuration
 * @returns {Promise<MenuConfig>}
 */
export async function getMenuConfig() {
	return new Promise((resolve) => {
		menuConfig.subscribe((config) => {
			resolve({ ...config });
		})();
	});
}

/**
 * Get menu items by category
 * @param {string} category - Category name (appetizers, mains, desserts, drinks)
 * @returns {Promise<MenuItem[]>}
 */
export async function getMenuItemsByCategory(category) {
	return new Promise((resolve) => {
		menuData.subscribe((data) => {
			resolve([...(data[category] || [])]);
		})();
	});
}

/**
 * Get menu context string for AI
 * NOTE: This function is deprecated. Use getMenuContextString from show-menu.js directly with contextConfig.
 * @deprecated Use getMenuContextString from show-menu.js with contextConfig from skill config
 * @returns {Promise<string>}
 */
export async function getMenuContextString() {
	throw new Error('getMenuContextString from menu-store.js is deprecated. Use getMenuContextString from show-menu.js with contextConfig from skill config.');
}

