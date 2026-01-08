/**
 * Dynamic Schema Migration Utility
 *
 * Automatically ensures a schema exists in root.schemata and creates entity instances
 * Works with any JSON Schema definition
 */

import { co, Group, z } from 'jazz-tools'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { jsonSchemaToZod } from './json-schema-to-zod.js'
import { SchemaMetaSchema } from '../schemas/schema-meta-schema.js'

// ============================================
// CREATION LOCKS TO PREVENT RACE CONDITIONS
// ============================================

/**
 * In-memory locks to prevent concurrent schema creation
 * Key: schema name, Value: Promise
 * NOTE: We don't cache schemas - Jazz handles that with its local-first architecture
 */
const schemaCreationLocks = new Map<string, Promise<any>>();

/**
 * Adds @label and @schema properties to a JSON Schema if they don't already exist
 * @label is a computed field that provides a display name for CoValues
 * @schema identifies the schema type (set via setSystemProps)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addLabelToSchema(jsonSchema: any): any {
	if (!jsonSchema || jsonSchema.type !== 'object') {
		return jsonSchema
	}

	// Preserve all schema properties including required array
	const modifiedSchema = {
		...jsonSchema,
		properties: jsonSchema.properties ? { ...jsonSchema.properties } : {},
		required: jsonSchema.required ? [...jsonSchema.required] : undefined,
	}

	// Add @label if it doesn't exist (but don't add it to required array)
	if (!modifiedSchema.properties['@label']) {
		modifiedSchema.properties['@label'] = {
			type: 'string',
			description: 'Computed display label for this CoValue',
		}
		// Note: @label is NOT added to required array since it's computed
	}

	// Add @schema if it doesn't exist (but don't add it to required array)
	if (!modifiedSchema.properties['@schema']) {
		modifiedSchema.properties['@schema'] = {
			type: 'o-map',
			description: 'Reference to SchemaDefinition CoValue (meta-schema references itself, entities reference their schema definition)',
		}
		// Note: @schema is NOT added to required array since it's set via setSystemProps
	}

	// Recursively add @label to nested o-map schemas
	for (const [key, propertySchema] of Object.entries(modifiedSchema.properties)) {
		const prop = propertySchema as any
		const type = prop.type

		if (type === 'o-map' && prop.properties) {
			modifiedSchema.properties[key] = {
				...prop,
				properties: addLabelToSchema({ type: 'object', properties: prop.properties }).properties,
			}
		} else if (type === 'o-list' && prop.items?.type === 'o-map' && prop.items.properties) {
			modifiedSchema.properties[key] = {
				...prop,
				items: {
					...prop.items,
					properties: addLabelToSchema({ type: 'object', properties: prop.items.properties }).properties,
				},
			}
		} else if (type === 'o-feed' && prop.items?.type === 'o-map' && prop.items.properties) {
			modifiedSchema.properties[key] = {
				...prop,
				items: {
					...prop.items,
					properties: addLabelToSchema({ type: 'object', properties: prop.items.properties }).properties,
				},
			}
		}
	}

	return modifiedSchema
}

/**
 * Extracts nested CoValue schemas (o-map) from JSON Schema recursively
 * Creates separate Jazz schemas for each nested o-map for direct linking
 * Returns a map of $ref identifiers -> Jazz schema definitions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNestedCoValueSchemas(
	jsonSchema: any,
	parentPath: string = '',
	extracted: Record<string, any> = {},
): Record<string, any> {
	if (!jsonSchema.properties) {
		return extracted
	}

	for (const [key, propertySchema] of Object.entries(jsonSchema.properties)) {
		const prop = propertySchema as any
		const type = prop.type
		const currentPath = parentPath ? `${parentPath}/${key}` : key

		// Extract nested o-map definitions
		if (type === 'o-map' && prop.properties) {
			// Recursively extract nested schemas within this o-map
			extractNestedCoValueSchemas(prop, currentPath, extracted)

			// Create the schema for this CoMap
			const nestedShape: Record<string, any> = {}
			const nestedRequired = prop.required || []

			for (const [nestedKey, nestedProp] of Object.entries(prop.properties)) {
				const nestedIsOptional = !nestedRequired.includes(nestedKey)
				nestedShape[nestedKey] = jsonSchemaToZod(nestedProp as any, nestedIsOptional, extracted)
			}

			// Store the extracted schema with a $ref identifier
			extracted[currentPath] = co.map(nestedShape)
		}
		// Extract o-list items that are o-map
		else if (type === 'o-list' && prop.items?.type === 'o-map' && prop.items.properties) {
			const itemPath = `${currentPath}/items`

			// Recursively extract nested schemas within the item o-map
			extractNestedCoValueSchemas(prop.items, itemPath, extracted)

			// Create the schema for the item CoMap
			const itemShape: Record<string, any> = {}
			const itemRequired = prop.items.required || []

			for (const [itemKey, itemProp] of Object.entries(prop.items.properties)) {
				const itemIsOptional = !itemRequired.includes(itemKey)
				itemShape[itemKey] = jsonSchemaToZod(itemProp as any, itemIsOptional, extracted)
			}

			// Store the extracted schema
			extracted[itemPath] = co.map(itemShape)
		}
		// Extract o-feed items that are o-map
		else if (type === 'o-feed' && prop.items?.type === 'o-map' && prop.items.properties) {
			const itemPath = `${currentPath}/items`

			// Recursively extract nested schemas within the item o-map
			extractNestedCoValueSchemas(prop.items, itemPath, extracted)

			// Create the schema for the item CoMap
			const itemShape: Record<string, any> = {}
			const itemRequired = prop.items.required || []

			for (const [itemKey, itemProp] of Object.entries(prop.items.properties)) {
				const itemIsOptional = !itemRequired.includes(itemKey)
				itemShape[itemKey] = jsonSchemaToZod(itemProp as any, itemIsOptional, extracted)
			}

			// Store the extracted schema
			extracted[itemPath] = co.map(itemShape)
		}
	}

	return extracted
}

/**
 * Adds $ref properties to nested o-map definitions in JSON Schema
 * This marks them for direct linking instead of inline embedding
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addReferencesToSchema(jsonSchema: any, parentPath: string = ''): any {
	if (!jsonSchema.properties) {
		return jsonSchema
	}

	// Preserve all schema properties including required array
	const modifiedSchema = {
		...jsonSchema,
		properties: {},
		required: jsonSchema.required ? [...jsonSchema.required] : undefined,
	}

	for (const [key, propertySchema] of Object.entries(jsonSchema.properties)) {
		const prop = propertySchema as any
		const type = prop.type
		const currentPath = parentPath ? `${parentPath}/${key}` : key

		if (type === 'o-map' && prop.properties) {
			// Add $ref for direct linking
			modifiedSchema.properties[key] = {
				...addReferencesToSchema(prop, currentPath),
				$ref: currentPath,
			}
		} else if (type === 'o-list' && prop.items?.type === 'o-map' && prop.items.properties) {
			// Add $ref to items for direct linking
			const itemPath = `${currentPath}/items`
			modifiedSchema.properties[key] = {
				...prop,
				items: {
					...addReferencesToSchema(prop.items, itemPath),
					$ref: itemPath,
				},
			}
		} else if (type === 'o-feed' && prop.items?.type === 'o-map' && prop.items.properties) {
			// Add $ref to items for direct linking
			const itemPath = `${currentPath}/items`
			modifiedSchema.properties[key] = {
				...prop,
				items: {
					...addReferencesToSchema(prop.items, itemPath),
					$ref: itemPath,
				},
			}
		} else {
			modifiedSchema.properties[key] = prop
		}
	}

	return modifiedSchema
}

/**
 * Converts JSON Schema to a co.map() shape object
 * Extracts nested CoValue schemas for direct linking
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonSchemaToCoMapShape(jsonSchema: any): Record<string, any> {
	if (!jsonSchema || jsonSchema.type !== 'object') {
		throw new Error('JSON Schema must be an object type')
	}

	if (!jsonSchema.properties) {
		return {}
	}

	// Step 1: Extract all nested CoValue schemas
	const extractedSchemas = extractNestedCoValueSchemas(jsonSchema)

	// Step 2: Add $ref properties to the schema
	const schemaWithRefs = addReferencesToSchema(jsonSchema)

	// Step 3: Convert to co.map shape using extracted schemas for direct linking
	const shape: Record<string, any> = {}
	const required = schemaWithRefs.required || []

	for (const [key, value] of Object.entries(schemaWithRefs.properties)) {
		const isOptional = !required.includes(key)
		shape[key] = jsonSchemaToZod(value as any, isOptional, extractedSchemas)
	}

	return shape
}

/**
 * Gets or creates the SchemaDefinition CoMap schema dynamically
 * This creates a co.map() schema based on the meta-schema JSON Schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaDefinitionCoMap(metaSchemaJson: any): any {
	const schemaDefinitionShape = jsonSchemaToCoMapShape(metaSchemaJson)
	return co.map(schemaDefinitionShape)
}

/**
 * Gets or creates the Entity CoMap schema dynamically
 * This creates a co.map() schema based on the Entity JSON Schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEntityCoMap(): any {
	const entitySchemaJson = {
		type: 'object',
		properties: {
			'@schema': { type: 'o-map' },
			'@label': { type: 'string' },
			name: { type: 'string' },
			type: { type: 'string' },
			primitive: { type: 'string' },
		},
		required: ['type'],
	}
	const entityShape = jsonSchemaToCoMapShape(entitySchemaJson)
	return co.map(entityShape)
}

/**
 * Gets the LocalNode from an account or a CoValue
 * Tries multiple methods to get the node
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNode(accountOrCoValue: any): any {
	try {
		// Method 1: Try from account's raw
		const raw = (accountOrCoValue as any).$jazz?.raw
		if (raw?.core?.node) {
			return raw.core.node
		}

		// Method 2: Try from account's core directly
		if ((accountOrCoValue as any).core?.node) {
			return (accountOrCoValue as any).core.node
		}

		// Method 3: Try from a CoValue's core
		const coValueRaw = (accountOrCoValue as any).$jazz?.raw
		if (coValueRaw?.core?.node) {
			return coValueRaw.core.node
		}

		return null
	} catch (_e) {
		return null
	}
}

/**
 * Ensures the meta-schema "Schema" exists (defines the schema for SchemaDefinition itself)
 * This is called before creating any other schema to ensure the meta-schema is available
 *
 * @param account - The Jazz account
 * @returns The meta-schema SchemaDefinition CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureMetaSchema(account: any): Promise<any> {
	const schemaName = 'Schema';
	
	// Check if creation is already in progress (prevent race conditions)
	if (schemaCreationLocks.has(schemaName)) {
		console.log(`[ensureMetaSchema] ⏳ Waiting for ongoing creation of "${schemaName}"`);
		return schemaCreationLocks.get(schemaName);
	}
	
	// Create lock for this schema
	const creationPromise = (async () => {
		try {
			// ⚡ OPTIMIZED: Check if already loaded to avoid unnecessary await
			let root = account.root
			if (!root?.$isLoaded) {
				const loadedAccount = await account.$jazz.ensureLoaded({
					resolve: { root: true },
				})

				if (!loadedAccount.root) {
					throw new Error('Root does not exist')
				}

				root = loadedAccount.root
			}

			// Ensure schemata list exists
			if (!root.$jazz.has('schemata')) {
				throw new Error('Schemata list does not exist - run account migration first')
			}

			// ⚡ OPTIMIZED: Check if schemata already loaded
			let schemataList = root.schemata
			if (!schemataList?.$isLoaded) {
				const rootWithSchemata = await root.$jazz.ensureLoaded({
					resolve: { schemata: true },
				})
				schemataList = rootWithSchemata.schemata
			}

			if (!schemataList) {
				throw new Error('Schemata list could not be loaded')
			}

			// ⚡ OPTIMIZED: Only await if not already loaded
			if (!schemataList.$isLoaded) {
				await schemataList.$jazz.ensureLoaded()
			}
			// ⚡ LOCAL-FIRST: Jazz loads from local cache instantly

	// Get node to load CoValues by ID (like resolveCoValue does)
	// Try account first, then root as fallback
	let node = getNode(account)
	if (!node && root) {
		node = getNode(root)
	}
	if (!node) {
		throw new Error('Cannot get LocalNode from account or root')
	}

	if (schemataList.$isLoaded) {
		const schemataArray = Array.from(schemataList)
		console.log(`[ensureMetaSchema] Checking ${schemataArray.length} schemas for "Schema"`)
		for (const schema of schemataArray) {
			if (schema && typeof schema === 'object' && '$jazz' in schema) {
				try {
					// Get the CoValue ID from the list item
					const schemaId = (schema as any).$jazz?.id
					if (!schemaId) {
						continue
					}

					// ⚡ OPTIMIZED: Check if schema is already loaded before awaiting node.load
					const schemaObj = schema as any
					let schemaNameValue: string | undefined

					if (schemaObj.$isLoaded && schemaObj.name) {
						// ⚡ Already loaded - access synchronously
						schemaNameValue = schemaObj.name
						console.log(`[ensureMetaSchema] Found schema (cached) - name: "${schemaNameValue}", ID: ${schemaId}`)
					} else {
						// Not loaded yet - load from node
						const loadedValue = await node.load(schemaId as any)
						if (loadedValue === 'unavailable') {
							continue
						}

						// Get snapshot using toJSON() - same as resolveCoValue does
						const snapshot = loadedValue.toJSON()
						if (!snapshot || typeof snapshot !== 'object' || snapshot === null) {
							continue
						}

						// Read name from snapshot (like ListView/Context do)
						schemaNameValue = (snapshot as any).name as string | undefined
						console.log(`[ensureMetaSchema] Found schema (loaded) - name: "${schemaNameValue}", ID: ${schemaId}`)
					}

					// Check if name matches 'Schema' (case-sensitive exact match)
					if (typeof schemaNameValue === 'string' && schemaNameValue === 'Schema') {
						console.log(`[ensureMetaSchema] Meta-schema "Schema" already exists, returning existing`)
						// ⚡ Jazz handles caching internally with its local-first architecture
						return schemaObj
					}
				} catch (error) {
					console.error(`[ensureMetaSchema] Error loading schema:`, error)
					// Skip this schema if there's an error loading it
					continue
				}
			}
		}
	}
	console.log(`[ensureMetaSchema] Meta-schema "Schema" not found, creating new`)

	// Meta-schema doesn't exist, create it directly (without calling ensureSchema to avoid recursion)
	const schemataOwner = (schemataList as any).$jazz?.owner
	if (!schemataOwner) {
		throw new Error('Cannot determine schemata list owner')
	}

	// Add @label and @schema to meta-schema JSON Schema
	const metaSchemaWithLabel = addLabelToSchema(SchemaMetaSchema)

	// Get SchemaDefinition CoMap schema dynamically
	const SchemaDefinitionCoMap = getSchemaDefinitionCoMap(metaSchemaWithLabel)

	// Create meta-schema SchemaDefinition dynamically (no entities list - entities stored in root.entities)
	const metaSchema = SchemaDefinitionCoMap.create(
		{
			name: 'Schema',
			definition: metaSchemaWithLabel,
		},
		schemataOwner,
	)
	// ⚡ LOCAL-FIRST: No waitForSync - creation is instant, sync happens in background

	// Explicitly set name property using $jazz.set to ensure it's stored
	metaSchema.$jazz.set('name', 'Schema')
	// ⚡ LOCAL-FIRST: No waitForSync

	// Set the type property to "MetaSchema" for the meta-schema itself
	metaSchema.$jazz.set('type', 'MetaSchema')
	// ⚡ LOCAL-FIRST: No waitForSync

	// Verify name and type were set
	const verifyName = metaSchema.name
	const verifyType = metaSchema.type
	console.log(`[ensureMetaSchema] Created meta-schema, name after set: "${verifyName}", type: "${verifyType}", ID: ${metaSchema.$jazz.id}`)

	// Set system properties (@label and @schema) - meta-schema references itself
	const { setSystemProps } = await import('../functions/set-system-props.js')
	await setSystemProps(metaSchema, metaSchema)

	// Add meta-schema to schemata list
	schemataList.$jazz.push(metaSchema)
	// ⚡ LOCAL-FIRST: No waitForSync - push is instant, sync happens in background

	// Return the meta-schema
	console.log(`[ensureMetaSchema] ⚡ Meta-schema created instantly (local-first)`);
	return await metaSchema.$jazz.ensureLoaded({ resolve: {} })
		} finally {
			// Remove lock when done
			schemaCreationLocks.delete(schemaName);
		}
	})();
	
	// Store lock and return promise
	schemaCreationLocks.set(schemaName, creationPromise);
	return creationPromise;
}

/**
 * Ensures a schema exists in root.schemata, creates it if needed
 * Automatically ensures the meta-schema exists first
 *
 * @param account - The Jazz account
 * @param schemaName - Name of the schema (e.g., "Car")
 * @param jsonSchema - JSON Schema definition
 * @returns The SchemaDefinition CoValue
 */
export async function ensureSchema(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	schemaName: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	jsonSchema: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	// Check if creation is already in progress (prevent race conditions)
	if (schemaCreationLocks.has(schemaName)) {
		console.log(`[ensureSchema] ⏳ Waiting for ongoing creation of "${schemaName}"`);
		return schemaCreationLocks.get(schemaName);
	}
	
	// Create lock for this schema
	const creationPromise = (async () => {
		try {
			// Ensure meta-schema exists first (unless we're creating the meta-schema itself)
			if (schemaName !== 'Schema') {
				await ensureMetaSchema(account)
			}

			// Add @label to the schema automatically
			const jsonSchemaWithLabel = addLabelToSchema(jsonSchema)

	// ⚡ OPTIMIZED: Check if already loaded to avoid unnecessary await
	// Only await if data isn't already available locally
	let root = account.root
	if (!root?.$isLoaded) {
		const freshRoot = await account.$jazz.ensureLoaded({
			resolve: { root: { schemata: true } },
		})
		if (!freshRoot.root) {
			throw new Error('Root does not exist')
		}
		root = freshRoot.root
	}

	// Ensure schemata list exists
	if (!root.$jazz.has('schemata')) {
		throw new Error('Schemata list does not exist - run account migration first')
	}

	const schemataList = root.schemata
	if (!schemataList) {
		throw new Error('Schemata list could not be loaded')
	}

	// ⚡ OPTIMIZED: Only await if not already loaded
	if (!schemataList.$isLoaded) {
		await schemataList.$jazz.ensureLoaded()
	}
	// ⚡ LOCAL-FIRST: No waitForSync - Jazz loads from local cache instantly

	// Get node to load CoValues by ID (like resolveCoValue does)
	// Try account first, then root as fallback
	let node = getNode(account)
	if (!node && root) {
		node = getNode(root)
	}
	if (!node) {
		throw new Error('Cannot get LocalNode from account or root')
	}

	// Check if schema already exists
	if (schemataList.$isLoaded) {
		const schemataArray = Array.from(schemataList)
		console.log(`[ensureSchema] Checking ${schemataArray.length} schemas for "${schemaName}"`)
		for (const schema of schemataArray) {
			if (schema && typeof schema === 'object' && '$jazz' in schema) {
				try {
					// Get the CoValue ID from the list item
					const schemaId = (schema as any).$jazz?.id
					if (!schemaId) {
						continue
					}

					// ⚡ OPTIMIZED: Check if schema is already loaded before awaiting node.load
					// If already loaded, we can access properties synchronously
					const schemaObj = schema as any
					let schemaNameValue: string | undefined

					if (schemaObj.$isLoaded && schemaObj.name) {
						// ⚡ Already loaded - access synchronously
						schemaNameValue = schemaObj.name
						console.log(`[ensureSchema] Found schema (cached) - name: "${schemaNameValue}", ID: ${schemaId}`)
					} else {
						// Not loaded yet - load from node
						const loadedValue = await node.load(schemaId as any)
						if (loadedValue === 'unavailable') {
							continue
						}

						// Get snapshot using toJSON() - same as resolveCoValue does
						const snapshot = loadedValue.toJSON()
						if (!snapshot || typeof snapshot !== 'object' || snapshot === null) {
							continue
						}

						// Read name from snapshot (like ListView/Context do)
						schemaNameValue = (snapshot as any).name as string | undefined
						console.log(`[ensureSchema] Found schema (loaded) - name: "${schemaNameValue}", ID: ${schemaId}`)
					}

					// Check if name matches (case-sensitive exact match)
					if (typeof schemaNameValue === 'string' && schemaNameValue === schemaName) {
						console.log(`[ensureSchema] Schema "${schemaName}" already exists, returning existing`)
						// ⚡ OPTIMIZED: If already loaded, return immediately without await
						if (schemaObj.$isLoaded) {
							return schemaObj
						}
						// Not loaded - ensure loaded before returning
						return await schemaObj.$jazz.ensureLoaded({ resolve: {} })
					}
				} catch (error) {
					console.error(`[ensureSchema] Error loading schema:`, error)
					// Skip this schema if there's an error loading it
					continue
				}
			}
		}
	}
	console.log(`[ensureSchema] Schema "${schemaName}" not found, creating new`)

	// Schema doesn't exist, create it AND all nested schemas

	// Get the owner group from the schemata list
	const schemataOwner = (schemataList as any).$jazz?.owner
	if (!schemataOwner) {
		throw new Error('Cannot determine schemata list owner')
	}

	// Step 1: Extract all nested CoValue schemas (use schema with @label)
	// For Entity schema, there are no nested schemas, so this should return empty
	const extractedSchemas = extractNestedCoValueSchemas(jsonSchemaWithLabel)
	console.log(`[ensureSchema] Extracted ${Object.keys(extractedSchemas).length} nested schemas for "${schemaName}"`)

	// Step 2: Create SchemaDefinition entries for each extracted nested schema
	// Store mapping of refPath -> SchemaDefinition CoValue ID
	const nestedSchemaIdMap: Record<string, string> = {}

	for (const [refPath] of Object.entries(extractedSchemas)) {
		// Generate a name for this nested schema (e.g., "JazzComposite/NestedCoMap")
		const nestedSchemaName = `${schemaName}/${refPath
			.split('/')
			.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
			.join('/')}`

		// Check if this nested schema already exists
		let existingNestedSchema: any = null
		if (schemataList.$isLoaded) {
			const schemataArray = Array.from(schemataList)
			for (const schema of schemataArray) {
				if (schema && typeof schema === 'object' && '$jazz' in schema) {
					const schemaObj = schema as any
					// ⚡ OPTIMIZED: Check if already loaded to avoid await
					if (schemaObj.$isLoaded) {
						// Already loaded - check synchronously
						if (schemaObj.name === nestedSchemaName) {
							existingNestedSchema = schemaObj
							break
						}
					} else {
						// Not loaded - await loading
						const schemaLoaded = await schemaObj.$jazz.ensureLoaded()
						if (schemaLoaded.$isLoaded && schemaLoaded.name === nestedSchemaName) {
							existingNestedSchema = schemaLoaded
							break
						}
					}
				}
			}
		}

		if (existingNestedSchema) {
			// Store the existing schema's ID
			nestedSchemaIdMap[refPath] = existingNestedSchema.$jazz.id
		} else {
		// Create a group for the nested schema's entities list
		const nestedEntitiesGroup = Group.create()
		// ⚡ LOCAL-FIRST: No waitForSync - group creation is instant

			// Get properties from the JSON Schema at this path (use schema with @label and @schema)
			const nestedProperties = getPropertiesFromPath(jsonSchemaWithLabel, refPath)
			const nestedRequired = getRequiredFromPath(jsonSchemaWithLabel, refPath)

			// Ensure @label and @schema are in nested properties (should already be there from addLabelToSchema)
			if (!nestedProperties['@label']) {
				nestedProperties['@label'] = {
					type: 'string',
					description: 'Computed display label for this CoValue',
				}
			}
			if (!nestedProperties['@schema']) {
				nestedProperties['@schema'] = {
					type: 'o-map',
					description: 'Reference to SchemaDefinition CoValue',
				}
			}

			// Create JSON Schema definition for this nested schema
			const nestedJsonSchema = {
				type: 'object',
				properties: nestedProperties,
				required: nestedRequired,
			}

			// Get SchemaDefinition CoMap schema dynamically
			const metaSchemaForNested = await ensureMetaSchema(account)
			const metaSchemaLoaded = await metaSchemaForNested.$jazz.ensureLoaded({ resolve: {} })
			const SchemaDefinitionCoMap = getSchemaDefinitionCoMap(metaSchemaLoaded.definition)

			// Create SchemaDefinition for the nested schema (no entities list - entities stored in root.entities)
			const nestedSchemaDefinition = SchemaDefinitionCoMap.create(
				{
					name: nestedSchemaName,
					definition: nestedJsonSchema,
				},
			schemataOwner,
		)
		// ⚡ LOCAL-FIRST: No waitForSync - schema creation is instant

			// Set system properties (@label and @schema) - nested schema references meta-schema
			const { setSystemProps } = await import('../functions/set-system-props.js')
			await setSystemProps(nestedSchemaDefinition, metaSchemaForNested)

			// Add to schemata list
			schemataList.$jazz.push(nestedSchemaDefinition)

			// Store the new schema's CoValue ID
			nestedSchemaIdMap[refPath] = nestedSchemaDefinition.$jazz.id
		}
	}

	// ⚡ LOCAL-FIRST: No waitForSync - all operations are instant locally

	// Step 3: Create a modified JSON Schema with $ref (CoValue IDs) for nested schemas (use schema with @label)
	const modifiedJsonSchema = replaceNestedSchemasWithRefs(
		jsonSchemaWithLabel,
		schemaName,
		nestedSchemaIdMap,
		'',
	)

	// Step 4: Get SchemaDefinition CoMap schema dynamically
	// Meta-schema was already ensured at the start of this function, so get it from the list
	const metaSchema = await ensureMetaSchema(account)
	const metaSchemaLoaded = await metaSchema.$jazz.ensureLoaded({ resolve: {} })

	// Get definition - it might be stored as a CoValue reference, so get the actual JSON Schema
	let metaSchemaDefinition = metaSchemaLoaded.definition
	// If definition is a CoValue reference (has $jazz), get its snapshot
	if (metaSchemaDefinition && typeof metaSchemaDefinition === 'object' && '$jazz' in metaSchemaDefinition) {
		const defLoaded = await (metaSchemaDefinition as any).$jazz.ensureLoaded({ resolve: {} })
		metaSchemaDefinition = defLoaded.toJSON ? defLoaded.toJSON() : metaSchemaDefinition
	}
	// If definition is still not a plain object, try toJSON on the metaSchema itself
	if (!metaSchemaDefinition || typeof metaSchemaDefinition !== 'object' || metaSchemaDefinition.type !== 'object') {
		const metaSnapshot = metaSchemaLoaded.toJSON ? metaSchemaLoaded.toJSON() : {}
		if (metaSnapshot && typeof metaSnapshot === 'object' && 'definition' in metaSnapshot) {
			metaSchemaDefinition = (metaSnapshot as any).definition
		}
	}

	// Fallback: use the SchemaMetaSchema directly if we can't get it from the loaded schema
	if (!metaSchemaDefinition || typeof metaSchemaDefinition !== 'object' || metaSchemaDefinition.type !== 'object') {
		console.log('[ensureSchema] Using SchemaMetaSchema directly as fallback')
		metaSchemaDefinition = addLabelToSchema(SchemaMetaSchema)
	}

	const SchemaDefinitionCoMap = getSchemaDefinitionCoMap(metaSchemaDefinition)

	// Create SchemaDefinition with modified JSON Schema (using $ref) - no entities list (entities stored in root.entities)
	const newSchema = SchemaDefinitionCoMap.create(
		{
			name: schemaName,
			definition: modifiedJsonSchema, // Use modified schema with $ref
		},
		schemataOwner,
	)
	// ⚡ LOCAL-FIRST: No waitForSync - schema creation is instant

	// Explicitly set name property using $jazz.set to ensure it's stored
	// This is a workaround in case the dynamic schema creation doesn't properly set it
	newSchema.$jazz.set('name', schemaName)
	// ⚡ LOCAL-FIRST: No waitForSync - property set is instant
	
	// Explicitly set definition property using $jazz.set to ensure passthrough object is stored correctly
	// Passthrough objects need to be explicitly set to ensure nested properties are serialized
	newSchema.$jazz.set('definition', modifiedJsonSchema)
	// ⚡ LOCAL-FIRST: No waitForSync - property set is instant
	
	// Verify definition was set correctly
	const verifyDefinition = newSchema.definition
	console.log(`[ensureSchema] Created schema "${schemaName}", definition after set:`, {
		hasDefinition: !!verifyDefinition,
		definitionType: typeof verifyDefinition,
		hasProperties: !!verifyDefinition?.properties,
		propertyKeys: verifyDefinition?.properties ? Object.keys(verifyDefinition.properties) : null
	})

	// Verify name was set
	const verifyName = newSchema.name
	console.log(`[ensureSchema] Created schema "${schemaName}", name after set: "${verifyName}", ID: ${newSchema.$jazz.id}`)

	// Set system properties (@label and @schema) - schema references meta-schema
	const { setSystemProps } = await import('../functions/set-system-props.js')
	await setSystemProps(newSchema, metaSchema)

	// Add SchemaDefinition to schemata list
	schemataList.$jazz.push(newSchema)
	// ⚡ LOCAL-FIRST: No waitForSync - push is instant, sync happens in background

	// Return the newly created schema
	console.log(`[ensureSchema] ⚡ Schema "${schemaName}" created instantly (local-first)`);
	return await newSchema.$jazz.ensureLoaded({ resolve: {} })
		} finally {
			// Remove lock when done
			schemaCreationLocks.delete(schemaName);
		}
	})();
	
	// Store lock and return promise
	schemaCreationLocks.set(schemaName, creationPromise);
	return creationPromise;
}

/**
 * Creates an entity instance for a given schema
 * Automatically ensures the schema exists first
 * Creates Entity instance and adds it to root.entities
 *
 * @param account - The Jazz account
 * @param schemaName - Name of the schema (e.g., "Car")
 * @param jsonSchema - JSON Schema definition
 * @param entityData - Data for the entity instance (name will be extracted if present)
 * @returns The created Entity instance
 */
export async function createEntity(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	schemaName: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	jsonSchema: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	entityData: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	// Ensure schema exists (creates if needed)
	await ensureSchema(account, schemaName, jsonSchema)

	// Load root and ensure entities list exists
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist')
	}

	const root = loadedAccount.root

	// Ensure entities list exists
	if (!root.$jazz.has('entities')) {
		throw new Error('Entities list does not exist - run account migration first')
	}

	// Load entities list
	const rootWithEntities = await root.$jazz.ensureLoaded({
		resolve: { entities: true },
	})
	const entitiesList = rootWithEntities.entities

	if (!entitiesList) {
		throw new Error('Entities list could not be loaded')
	}

	// Get the owner group from the entities list
	const entitiesOwner = (entitiesList as any).$jazz?.owner
	if (!entitiesOwner) {
		throw new Error('Cannot determine entities list owner')
	}

	// Extract name from entityData if present
	const entityName = entityData?.name || entityData?.text || undefined

	// Ensure Entity schema exists and get it for @schema reference
	const entitySchemaJson = {
		type: 'object',
		properties: {
			'@schema': { type: 'o-map' },
			'@label': { type: 'string' },
			name: { type: 'string' },
			type: { type: 'string' },
			primitive: { type: 'string' },
		},
		required: ['type'],
	}
	const entitySchemaDefinition = await ensureSchema(account, 'Entity', entitySchemaJson)

	// Get Entity CoMap schema dynamically
	const EntityCoMap = getEntityCoMap()

	// Create Entity instance
	const entityInstance = EntityCoMap.create(
		{
			name: entityName,
			type: schemaName,
			primitive: undefined, // Not set for now - can store CoValue ID or primitive value later
		},
		entitiesOwner,
	)
	// ⚡ LOCAL-FIRST: No waitForSync - entity creation is instant

	// Set system properties (@label and @schema) - entity references Entity schema definition
	const { setSystemProps } = await import('../functions/set-system-props.js')
	await setSystemProps(entityInstance, entitySchemaDefinition)

	// Add entity instance to root.entities list
	entitiesList.$jazz.push(entityInstance)
	// ⚡ LOCAL-FIRST: No waitForSync - push is instant, sync happens in background

	return entityInstance
}

/**
 * Helper to get properties from a JSON Schema at a specific path
 * Path format: "nestedCoMap" or "coListOfCoMaps/items"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPropertiesFromPath(jsonSchema: any, path: string): any {
	const parts = path.split('/')
	let current = jsonSchema.properties

	for (const part of parts) {
		if (part === 'items') {
			current = current?.items?.properties
		} else {
			current = current?.[part]
			if (current?.type === 'o-map') {
				current = current?.properties
			} else if (current?.type === 'o-list' || current?.type === 'o-feed') {
				current = current?.items?.properties
			}
		}
	}

	return current || {}
}

/**
 * Helper to get required fields from a JSON Schema at a specific path
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRequiredFromPath(jsonSchema: any, path: string): string[] {
	const parts = path.split('/')
	let current = jsonSchema

	for (const part of parts) {
		if (part === 'items') {
			current = current?.items
		} else {
			current = current?.properties?.[part]
		}
	}

	return current?.required || []
}

/**
 * Finds a nested schema by name from root.schemata
 *
 * @param account - The Jazz account
 * @param schemaName - Full schema name (e.g., "JazzComposite/NestedCoMap")
 * @returns The SchemaDefinition CoValue or null if not found
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findNestedSchema(account: any, schemaName: string): Promise<any | null> {
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		return null
	}

	const root = loadedAccount.root

	// Ensure schemata list exists
	if (!root.$jazz.has('schemata')) {
		return null
	}

	// Load schemata list
	const rootWithSchemata = await root.$jazz.ensureLoaded({
		resolve: { schemata: true },
	})
	const schemataList = rootWithSchemata.schemata

	if (!schemataList) {
		return null
	}

	// Search for schema by name
	if (schemataList.$isLoaded) {
		const schemataArray = Array.from(schemataList)

		// Get node to load CoValues by ID (like ensureSchema does)
		let node = getNode(account)
		if (!node) {
			const root = loadedAccount.root
			if (root) {
				node = getNode(root)
			}
		}
		if (!node) {
			return null
		}

		for (const schema of schemataArray) {
			if (schema && typeof schema === 'object' && '$jazz' in schema) {
				try {
					// Get the CoValue ID from the list item
					const schemaId = (schema as any).$jazz?.id
					if (!schemaId) {
						continue
					}

					// Load the actual CoValue from the node (like ensureSchema does)
					// This ensures we get the full CoValue with all properties
					const loadedValue = await node.load(schemaId as any)
					if (loadedValue === 'unavailable') {
						continue
					}

					// Get snapshot using toJSON() - same as ensureSchema does
					const snapshot = loadedValue.toJSON()
					if (!snapshot || typeof snapshot !== 'object' || snapshot === null) {
						continue
					}

					// Read name from snapshot (like ensureSchema does)
					const schemaNameValue = (snapshot as any).name as string | undefined

					// Check if name matches (case-sensitive exact match)
					if (typeof schemaNameValue === 'string' && schemaNameValue === schemaName) {
						// Return the schema from the list (it's already wrapped)
						const schemaLoaded = await (schema as any).$jazz.ensureLoaded({
							resolve: {},
						})
						return schemaLoaded
					}
				} catch (_error) {
					// Skip this schema if there's an error loading it
					continue
				}
			}
		}
	}

	return null
}

/**
 * Replace nested o-map definitions in JSON Schema with $ref (CoValue IDs) to created schemas
 * Handles nested structures recursively
 *
 * @param jsonSchema - The JSON Schema to process
 * @param schemaName - Base schema name (not used when we have idMap)
 * @param schemaIdMap - Map of refPath -> SchemaDefinition CoValue ID
 * @param parentPath - Current path in the schema tree (for recursion)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replaceNestedSchemasWithRefs(
	jsonSchema: any,
	_schemaName: string,
	schemaIdMap: Record<string, string> = {},
	parentPath: string = '',
): any {
	if (!jsonSchema.properties) {
		return jsonSchema
	}

	const modifiedSchema = {
		...jsonSchema,
		properties: {} as any,
	}

	for (const [key, propertySchema] of Object.entries(jsonSchema.properties)) {
		const prop = propertySchema as any
		const type = prop.type
		const currentPath = parentPath ? `${parentPath}/${key}` : key

		if (type === 'o-map' && prop.properties) {
			// For nested o-map, replace with $ref to the nested schema's CoValue ID
			const schemaId = schemaIdMap[currentPath]
			modifiedSchema.properties[key] = {
				type: 'o-map',
				$ref: schemaId || currentPath, // Use CoValue ID if available, fallback to path
				description: prop.description,
			}
		} else if (type === 'o-list' && prop.items?.type === 'o-map' && prop.items.properties) {
			// For o-list of o-map, replace items with $ref to CoValue ID
			const itemPath = `${currentPath}/items`
			const schemaId = schemaIdMap[itemPath]
			modifiedSchema.properties[key] = {
				type: 'o-list',
				items: {
					type: 'o-map',
					$ref: schemaId || itemPath, // Use CoValue ID if available, fallback to path
				},
				description: prop.description,
			}
		} else if (type === 'o-feed' && prop.items?.type === 'o-map' && prop.items.properties) {
			// For o-feed of o-map, replace items with $ref to CoValue ID
			const itemPath = `${currentPath}/items`
			const schemaId = schemaIdMap[itemPath]
			modifiedSchema.properties[key] = {
				type: 'o-feed',
				items: {
					type: 'o-map',
					$ref: schemaId || itemPath, // Use CoValue ID if available, fallback to path
				},
				description: prop.description,
			}
		} else {
			// Keep as is
			modifiedSchema.properties[key] = prop
		}
	}

	return modifiedSchema
}
