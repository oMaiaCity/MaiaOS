/**
 * Dynamic Schema Migration Utility
 * 
 * Automatically ensures a schema exists in root.data and creates entity instances
 * Works with any JSON Schema definition
 */

import { co, Group } from "jazz-tools";
import { SchemaDefinition } from "../schema.js";
import { jsonSchemaToZod } from "./json-schema-to-zod.js";

/**
 * Extracts nested CoValue schemas (o-map) from JSON Schema recursively
 * Creates separate Jazz schemas for each nested o-map for direct linking
 * Returns a map of $ref identifiers -> Jazz schema definitions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNestedCoValueSchemas(
  jsonSchema: any,
  parentPath: string = "",
  extracted: Record<string, any> = {}
): Record<string, any> {
  if (!jsonSchema.properties) {
    return extracted;
  }

  for (const [key, propertySchema] of Object.entries(jsonSchema.properties)) {
    const prop = propertySchema as any;
    const type = prop.type;
    const currentPath = parentPath ? `${parentPath}/${key}` : key;

    // Extract nested o-map definitions
    if (type === "o-map" && prop.properties) {
      // Recursively extract nested schemas within this o-map
      extractNestedCoValueSchemas(prop, currentPath, extracted);

      // Create the schema for this CoMap
      const nestedShape: Record<string, any> = {};
      const nestedRequired = prop.required || [];

      for (const [nestedKey, nestedProp] of Object.entries(prop.properties)) {
        const nestedIsOptional = !nestedRequired.includes(nestedKey);
        nestedShape[nestedKey] = jsonSchemaToZod(nestedProp as any, nestedIsOptional, extracted);
      }

      // Store the extracted schema with a $ref identifier
      extracted[currentPath] = co.map(nestedShape);
    }
    // Extract o-list items that are o-map
    else if (type === "o-list" && prop.items?.type === "o-map" && prop.items.properties) {
      const itemPath = `${currentPath}/items`;

      // Recursively extract nested schemas within the item o-map
      extractNestedCoValueSchemas(prop.items, itemPath, extracted);

      // Create the schema for the item CoMap
      const itemShape: Record<string, any> = {};
      const itemRequired = prop.items.required || [];

      for (const [itemKey, itemProp] of Object.entries(prop.items.properties)) {
        const itemIsOptional = !itemRequired.includes(itemKey);
        itemShape[itemKey] = jsonSchemaToZod(itemProp as any, itemIsOptional, extracted);
      }

      // Store the extracted schema
      extracted[itemPath] = co.map(itemShape);
    }
    // Extract o-feed items that are o-map
    else if (type === "o-feed" && prop.items?.type === "o-map" && prop.items.properties) {
      const itemPath = `${currentPath}/items`;

      // Recursively extract nested schemas within the item o-map
      extractNestedCoValueSchemas(prop.items, itemPath, extracted);

      // Create the schema for the item CoMap
      const itemShape: Record<string, any> = {};
      const itemRequired = prop.items.required || [];

      for (const [itemKey, itemProp] of Object.entries(prop.items.properties)) {
        const itemIsOptional = !itemRequired.includes(itemKey);
        itemShape[itemKey] = jsonSchemaToZod(itemProp as any, itemIsOptional, extracted);
      }

      // Store the extracted schema
      extracted[itemPath] = co.map(itemShape);
    }
  }

  return extracted;
}

/**
 * Adds $ref properties to nested o-map definitions in JSON Schema
 * This marks them for direct linking instead of inline embedding
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addReferencesToSchema(jsonSchema: any, parentPath: string = ""): any {
  if (!jsonSchema.properties) {
    return jsonSchema;
  }

  const modifiedSchema = { ...jsonSchema, properties: {} };

  for (const [key, propertySchema] of Object.entries(jsonSchema.properties)) {
    const prop = propertySchema as any;
    const type = prop.type;
    const currentPath = parentPath ? `${parentPath}/${key}` : key;

    if (type === "o-map" && prop.properties) {
      // Add $ref for direct linking
      modifiedSchema.properties[key] = {
        ...addReferencesToSchema(prop, currentPath),
        $ref: currentPath,
      };
    } else if (type === "o-list" && prop.items?.type === "o-map" && prop.items.properties) {
      // Add $ref to items for direct linking
      const itemPath = `${currentPath}/items`;
      modifiedSchema.properties[key] = {
        ...prop,
        items: {
          ...addReferencesToSchema(prop.items, itemPath),
          $ref: itemPath,
        },
      };
    } else if (type === "o-feed" && prop.items?.type === "o-map" && prop.items.properties) {
      // Add $ref to items for direct linking
      const itemPath = `${currentPath}/items`;
      modifiedSchema.properties[key] = {
        ...prop,
        items: {
          ...addReferencesToSchema(prop.items, itemPath),
          $ref: itemPath,
        },
      };
    } else {
      modifiedSchema.properties[key] = prop;
    }
  }

  return modifiedSchema;
}

/**
 * Converts JSON Schema to a co.map() shape object
 * Extracts nested CoValue schemas for direct linking
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonSchemaToCoMapShape(jsonSchema: any): Record<string, any> {
  if (!jsonSchema || jsonSchema.type !== "object") {
    throw new Error("JSON Schema must be an object type");
  }

  if (!jsonSchema.properties) {
    return {};
  }

  // Step 1: Extract all nested CoValue schemas
  const extractedSchemas = extractNestedCoValueSchemas(jsonSchema);

  // Step 2: Add $ref properties to the schema
  const schemaWithRefs = addReferencesToSchema(jsonSchema);

  // Step 3: Convert to co.map shape using extracted schemas for direct linking
  const shape: Record<string, any> = {};
  const required = schemaWithRefs.required || [];

  for (const [key, value] of Object.entries(schemaWithRefs.properties)) {
    const isOptional = !required.includes(key);
    shape[key] = jsonSchemaToZod(value as any, isOptional, extractedSchemas);
  }

  return shape;
}

/**
 * Ensures a schema exists in root.data, creates it if needed
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
  jsonSchema: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // Load root
  const loadedAccount = await account.$jazz.ensureLoaded({
    resolve: { root: true },
  });

  if (!loadedAccount.root) {
    throw new Error("Root does not exist");
  }

  const root = loadedAccount.root;

  // Ensure data list exists
  if (!root.$jazz.has("data")) {
    throw new Error("Data list does not exist - run account migration first");
  }

  // Load data list
  const rootWithData = await root.$jazz.ensureLoaded({
    resolve: { data: true },
  });
  const dataList = rootWithData.data;

  if (!dataList) {
    throw new Error("Data list could not be loaded");
  }

  // Check if schema already exists
  if (dataList.$isLoaded) {
    const dataArray = Array.from(dataList);
    for (const schema of dataArray) {
      if (schema && typeof schema === "object" && "$jazz" in schema) {
        const schemaLoaded = await (schema as any).$jazz.ensureLoaded({
          resolve: { entities: true },
        });
        if (schemaLoaded.$isLoaded && (schemaLoaded as any).name === schemaName) {
          // Schema exists, return it
          return schemaLoaded;
        }
      }
    }
  }

  // Schema doesn't exist, create it AND all nested schemas

  // Get the owner group from the data list
  const dataOwner = (dataList as any).$jazz?.owner;
  if (!dataOwner) {
    throw new Error("Cannot determine data list owner");
  }

  // Step 1: Extract all nested CoValue schemas  
  const extractedSchemas = extractNestedCoValueSchemas(jsonSchema);

  // Step 2: Create SchemaDefinition entries for each extracted nested schema
  // Store mapping of refPath -> SchemaDefinition CoValue ID
  const nestedSchemaIdMap: Record<string, string> = {};
  
  for (const [refPath, nestedCoMapSchema] of Object.entries(extractedSchemas)) {
    // Generate a name for this nested schema (e.g., "JazzComposite/NestedCoMap")
    const nestedSchemaName = `${schemaName}/${refPath.split('/').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join('/')}`;

    // Check if this nested schema already exists
    let existingNestedSchema: any = null;
    if (dataList.$isLoaded) {
      const dataArray = Array.from(dataList);
      for (const schema of dataArray) {
        if (schema && typeof schema === "object" && "$jazz" in schema) {
          const schemaLoaded = await (schema as any).$jazz.ensureLoaded();
          if (schemaLoaded.$isLoaded && (schemaLoaded as any).name === nestedSchemaName) {
            existingNestedSchema = schemaLoaded;
            break;
          }
        }
      }
    }

    if (existingNestedSchema) {
      // Store the existing schema's ID
      nestedSchemaIdMap[refPath] = existingNestedSchema.$jazz.id;
    } else {
      // Create a group for the nested schema's entities list
      const nestedEntitiesGroup = Group.create();
      await nestedEntitiesGroup.$jazz.waitForSync();

      // Get properties from the JSON Schema at this path
      const nestedProperties = getPropertiesFromPath(jsonSchema, refPath);
      const nestedRequired = getRequiredFromPath(jsonSchema, refPath);

      // Create JSON Schema definition for this nested schema
      const nestedJsonSchema = {
        type: "object",
        properties: nestedProperties,
        required: nestedRequired,
      };

      // Create SchemaDefinition for the nested schema
      const nestedSchemaDefinition = SchemaDefinition.create(
        {
          "@schema": "schema-definition",
          name: nestedSchemaName,
          definition: nestedJsonSchema,
          entities: co.list(nestedCoMapSchema).create([], nestedEntitiesGroup),
        },
        dataOwner
      );
      await nestedSchemaDefinition.$jazz.waitForSync();

      // Add to data list
      dataList.$jazz.push(nestedSchemaDefinition);
      
      // Store the new schema's CoValue ID
      nestedSchemaIdMap[refPath] = nestedSchemaDefinition.$jazz.id;
    }
  }

  await root.$jazz.waitForSync();

  // Step 3: Create a modified JSON Schema with $ref (CoValue IDs) for nested schemas
  const modifiedJsonSchema = replaceNestedSchemasWithRefs(jsonSchema, schemaName, nestedSchemaIdMap, "");

  // Step 4: Convert JSON Schema to co.map() shape - this creates the typed CoMap schema with direct links
  const entityShape = jsonSchemaToCoMapShape(jsonSchema);
  const EntityCoMapSchema = co.map(entityShape);

  // Step 5: Create a group for the main schema's entities list
  const entitiesGroup = Group.create();
  await entitiesGroup.$jazz.waitForSync();

  // Step 6: Create SchemaDefinition with modified JSON Schema (using $ref) and typed entities list
  const newSchema = SchemaDefinition.create(
    {
      "@schema": "schema-definition",
      name: schemaName,
      definition: modifiedJsonSchema, // Use modified schema with $ref
      entities: co.list(EntityCoMapSchema).create([], entitiesGroup), // Typed with actual schema!
    },
    dataOwner
  );
  await newSchema.$jazz.waitForSync();

  // Add SchemaDefinition to data list
  dataList.$jazz.push(newSchema);
  await root.$jazz.waitForSync();

  // Return the newly created schema (with entities resolved)
  return await newSchema.$jazz.ensureLoaded({ resolve: { entities: true } });
}

/**
 * Creates an entity instance for a given schema
 * Automatically ensures the schema exists first
 * 
 * @param account - The Jazz account
 * @param schemaName - Name of the schema (e.g., "Car")
 * @param jsonSchema - JSON Schema definition
 * @param entityData - Data for the entity instance
 * @returns The created entity instance
 */
export async function createEntity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
  schemaName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonSchema: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entityData: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // Ensure schema exists (creates if needed)
  const schema = await ensureSchema(account, schemaName, jsonSchema);

  // Get the entities list
  const entitiesList = schema.entities;
  if (!entitiesList) {
    throw new Error(`Schema ${schemaName} does not have entities list`);
  }

  // Convert JSON Schema to co.map() shape
  const entityShape = jsonSchemaToCoMapShape(jsonSchema);
  const EntityCoMapSchema = co.map(entityShape);

  // Get the owner group from the entities list
  const entitiesOwner = (entitiesList as any).$jazz?.owner;
  if (!entitiesOwner) {
    throw new Error("Cannot determine entities list owner");
  }

  // Create entity instance
  const entityInstance = EntityCoMapSchema.create(entityData, entitiesOwner);
  await entityInstance.$jazz.waitForSync();

  // Verify properties are accessible
  if (!entityInstance.$isLoaded) {
    await entityInstance.$jazz.ensureLoaded({ resolve: {} });
  }

  // Add entity instance to entities list
  entitiesList.$jazz.push(entityInstance);
  await account.$jazz.ensureLoaded({ resolve: { root: true } }); // Ensure root is synced

  return entityInstance;
}

/**
 * Helper to get properties from a JSON Schema at a specific path
 * Path format: "nestedCoMap" or "coListOfCoMaps/items"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPropertiesFromPath(jsonSchema: any, path: string): any {
  const parts = path.split('/');
  let current = jsonSchema.properties;

  for (const part of parts) {
    if (part === "items") {
      current = current?.items?.properties;
    } else {
      current = current?.[part];
      if (current?.type === "o-map") {
        current = current?.properties;
      } else if (current?.type === "o-list" || current?.type === "o-feed") {
        current = current?.items?.properties;
      }
    }
  }

  return current || {};
}

/**
 * Helper to get required fields from a JSON Schema at a specific path
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRequiredFromPath(jsonSchema: any, path: string): string[] {
  const parts = path.split('/');
  let current = jsonSchema;

  for (const part of parts) {
    if (part === "items") {
      current = current?.items;
    } else {
      current = current?.properties?.[part];
    }
  }

  return current?.required || [];
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
  schemaName: string,
  schemaIdMap: Record<string, string> = {},
  parentPath: string = ""
): any {
  if (!jsonSchema.properties) {
    return jsonSchema;
  }

  const modifiedSchema = {
    ...jsonSchema,
    properties: {} as any,
  };

  for (const [key, propertySchema] of Object.entries(jsonSchema.properties)) {
    const prop = propertySchema as any;
    const type = prop.type;
    const currentPath = parentPath ? `${parentPath}/${key}` : key;

    if (type === "o-map" && prop.properties) {
      // For nested o-map, replace with $ref to the nested schema's CoValue ID
      const schemaId = schemaIdMap[currentPath];
      modifiedSchema.properties[key] = {
        type: "o-map",
        $ref: schemaId || currentPath, // Use CoValue ID if available, fallback to path
        description: prop.description,
      };
    } else if (type === "o-list" && prop.items?.type === "o-map" && prop.items.properties) {
      // For o-list of o-map, replace items with $ref to CoValue ID
      const itemPath = `${currentPath}/items`;
      const schemaId = schemaIdMap[itemPath];
      modifiedSchema.properties[key] = {
        type: "o-list",
        items: {
          type: "o-map",
          $ref: schemaId || itemPath, // Use CoValue ID if available, fallback to path
        },
        description: prop.description,
      };
    } else if (type === "o-feed" && prop.items?.type === "o-map" && prop.items.properties) {
      // For o-feed of o-map, replace items with $ref to CoValue ID
      const itemPath = `${currentPath}/items`;
      const schemaId = schemaIdMap[itemPath];
      modifiedSchema.properties[key] = {
        type: "o-feed",
        items: {
          type: "o-map",
          $ref: schemaId || itemPath, // Use CoValue ID if available, fallback to path
        },
        description: prop.description,
      };
    } else {
      // Keep as is
      modifiedSchema.properties[key] = prop;
    }
  }

  return modifiedSchema;
}

