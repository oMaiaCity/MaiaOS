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
 * Converts JSON Schema to a co.map() shape object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonSchemaToCoMapShape(jsonSchema: any): Record<string, any> {
  if (!jsonSchema || jsonSchema.type !== "object") {
    throw new Error("JSON Schema must be an object type");
  }

  if (!jsonSchema.properties) {
    return {};
  }

  const shape: Record<string, any> = {};
  for (const [key, value] of Object.entries(jsonSchema.properties)) {
    shape[key] = jsonSchemaToZod(value as any);
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

  // Schema doesn't exist, create it

  // Get the owner group from the data list
  const dataOwner = (dataList as any).$jazz?.owner;
  if (!dataOwner) {
    throw new Error("Cannot determine data list owner");
  }

  // Convert JSON Schema to co.map() shape - this creates the typed CoMap schema
  const entityShape = jsonSchemaToCoMapShape(jsonSchema);
  const EntityCoMapSchema = co.map(entityShape);

  // Create a group for the entities list
  const entitiesGroup = Group.create();
  await entitiesGroup.$jazz.waitForSync();

  // Create SchemaDefinition with JSON Schema and typed entities list
  const newSchema = SchemaDefinition.create(
    {
      "@schema": "schema-definition",
      name: schemaName,
      definition: jsonSchema,
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
