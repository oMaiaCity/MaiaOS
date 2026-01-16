// Import DSL schemas directly (browser-compatible - Vite handles JSON imports)
import registerSchemaOp from "../../../schemata/operations/register-schema.operation.json";
import loadSchemaOp from "../../../schemata/operations/load-schema.operation.json";
import listSchemasOp from "../../../schemata/operations/list-schemas.operation.json";
import readOp from "../../../schemata/operations/read.operation.json";
import createOp from "../../../schemata/operations/create.operation.json";
import updateMapOp from "../../../schemata/operations/update-map.operation.json";
import updateListOp from "../../../schemata/operations/update-list.operation.json";
import deleteOp from "../../../schemata/operations/delete.operation.json";
import allLoadedOp from "../../../schemata/operations/all-loaded.operation.json";
import batchOp from "../../../schemata/operations/batch.operation.json";

/**
 * Simple JSON Schema validator
 * (In production, this would use Ajv or similar library)
 */
class SimpleValidator {
	constructor(schema) {
		this.schema = schema;
	}

	validate(data) {
		const errors = [];
		this._validateObject(data, this.schema, "", errors);

		if (errors.length > 0) {
			throw new Error(
				`Validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
			);
		}
	}

	_validateObject(data, schema, path, errors) {
		// Check required properties
		if (schema.required) {
			for (const prop of schema.required) {
				if (!(prop in data)) {
					errors.push(`Missing required property: ${path || "root"}.${prop}`);
				}
			}
		}

		// Check property types
		if (schema.properties) {
			for (const [key, propSchema] of Object.entries(schema.properties)) {
				const value = data[key];
				const propPath = path ? `${path}.${key}` : key;

				if (value !== undefined) {
					this._validateValue(value, propSchema, propPath, errors);
				}
			}
		}

		// Check for additional properties if not allowed
		if (schema.additionalProperties === false && schema.properties) {
			const allowedProps = Object.keys(schema.properties);
			for (const key of Object.keys(data)) {
				if (!allowedProps.includes(key)) {
					errors.push(`Additional property not allowed: ${path || "root"}.${key}`);
				}
			}
		}
	}

	_validateValue(value, schema, path, errors) {
		// Handle const
		if (schema.const !== undefined) {
			if (value !== schema.const) {
				errors.push(`${path} must be "${schema.const}", got "${value}"`);
			}
			return;
		}

		// Handle enum
		if (schema.enum) {
			if (!schema.enum.includes(value)) {
				errors.push(
					`${path} must be one of [${schema.enum.join(", ")}], got "${value}"`,
				);
			}
			return;
		}

		// Handle oneOf
		if (schema.oneOf) {
			let matched = false;
			for (const subSchema of schema.oneOf) {
				const subErrors = [];
				try {
					this._validateValue(value, subSchema, path, subErrors);
					if (subErrors.length === 0) {
						matched = true;
						break;
					}
				} catch {
					// Try next schema
				}
			}
			if (!matched) {
				errors.push(`${path} does not match any of the expected formats`);
			}
			return;
		}

		// Handle type
		if (schema.type) {
			const types = Array.isArray(schema.type) ? schema.type : [schema.type];
			const actualType = Array.isArray(value)
				? "array"
				: value === null
					? "null"
					: typeof value;

			if (!types.includes(actualType)) {
				errors.push(
					`${path} must be type ${types.join(" or ")}, got ${actualType}`,
				);
				return;
			}

			// Validate nested objects
			if (actualType === "object" && schema.properties) {
				this._validateObject(value, schema, path, errors);
			}

			// Validate arrays
			if (actualType === "array" && schema.items) {
				if (schema.minItems !== undefined && value.length < schema.minItems) {
					errors.push(
						`${path} must have at least ${schema.minItems} items, got ${value.length}`,
					);
				}
				for (let i = 0; i < value.length; i++) {
					this._validateValue(value[i], schema.items, `${path}[${i}]`, errors);
				}
			}

			// Validate numbers
			if (actualType === "number") {
				if (
					schema.minimum !== undefined &&
					value < schema.minimum
				) {
					errors.push(`${path} must be >= ${schema.minimum}, got ${value}`);
				}
				if (
					schema.maximum !== undefined &&
					value > schema.maximum
				) {
					errors.push(`${path} must be <= ${schema.maximum}, got ${value}`);
				}
			}

			// Validate strings
			if (actualType === "string") {
				if (schema.minLength !== undefined && value.length < schema.minLength) {
					errors.push(
						`${path} must have length >= ${schema.minLength}, got ${value.length}`,
					);
				}
				if (schema.pattern) {
					const regex = new RegExp(schema.pattern);
					if (!regex.test(value)) {
						errors.push(
							`${path} must match pattern ${schema.pattern}, got "${value}"`,
						);
					}
				}
			}
		}

		// Handle additionalProperties for nested objects
		if (
			typeof value === "object" &&
			!Array.isArray(value) &&
			value !== null
		) {
			if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
				// Validate each additional property against the schema
				for (const [key, val] of Object.entries(value)) {
					if (!schema.properties || !schema.properties[key]) {
						this._validateValue(
							val,
							schema.additionalProperties,
							`${path}.${key}`,
							errors,
						);
					}
				}
			}
		}
	}
}

/**
 * Operations Validator
 * Loads and validates operations against their DSL schemas
 */
export class OperationsValidator {
	constructor() {
		// Use directly imported DSL schemas (browser-compatible)
		this.schemas = {
			registerSchema: registerSchemaOp,
			loadSchema: loadSchemaOp,
			listSchemas: listSchemasOp,
			read: readOp,
			create: createOp,
			updateMap: updateMapOp,
			updateList: updateListOp,
			delete: deleteOp,
			allLoaded: allLoadedOp,
			batch: batchOp,
		};
	}

	/**
	 * Validates an operation against its DSL schema
	 * @param {object} operation - The operation to validate
	 * @throws {Error} If validation fails
	 */
	validate(operation) {
		if (!operation || typeof operation !== "object") {
			throw new Error("Operation must be an object");
		}

		if (!operation.op) {
			throw new Error('Operation must have an "op" property');
		}

		// Special handling for update operations (map vs list)
		let schemaKey = operation.op;
		if (operation.op === "update") {
			// Determine if it's a map or list update based on changes structure
			if (operation.changes && operation.changes.items) {
				schemaKey = "updateList";
			} else {
				schemaKey = "updateMap";
			}
		}

		const schema = this.schemas[schemaKey];
		if (!schema) {
			throw new Error(`No DSL schema found for operation: ${operation.op}`);
		}

		const validator = new SimpleValidator(schema);
		validator.validate(operation);
	}

	/**
	 * Gets the schema for a specific operation type
	 * @param {string} operationType - The operation type
	 * @returns {object} The JSON schema
	 */
	getSchema(operationType) {
		return this.schemas[operationType];
	}

	/**
	 * Gets all operation DSL schemas
	 * @returns {object} All DSL schemas by operation name
	 */
	getAllSchemas() {
		return { ...this.schemas };
	}
}
