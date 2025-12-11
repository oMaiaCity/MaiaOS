/**
 * Manual migration to add Cars list to root
 * This migration runs only when manually triggered, not automatically
 * 
 * Uses JSON Schema definition and converts it to Jazz Zod schema dynamically
 */

import { co, Group } from "jazz-tools";
import { jsonSchemaToZod } from "../functions/json-schema-to-zod.js";
import { SchemaDefinition } from "../schema.js";

// JSON Schema definition for Car
const CarJsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
    },
    color: {
      type: "string",
    },
  },
  required: ["name", "color"],
};

/**
 * Converts JSON Schema to a co.map() shape object
 * 
 * @param jsonSchema - JSON Schema object definition
 * @returns Shape object for co.map()
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
 * Manually adds a Car SchemaDefinition to root.data if it doesn't exist
 * The SchemaDefinition contains the JSON Schema definition and an empty entities list
 * 
 * @param account - The Jazz account
 */
export async function migrateAddCars(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any
): Promise<void> {
  // Load root
  const loadedAccount = await account.$jazz.ensureLoaded({
    resolve: { root: true },
  });

  if (!loadedAccount.root) {
    throw new Error("Root does not exist");
  }

  const root = loadedAccount.root;

  // Ensure data list exists (list of SchemaDefinitions)
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

  // Check if Car SchemaDefinition already exists
  if (dataList.$isLoaded) {
    const dataArray = Array.from(dataList);
    for (const schema of dataArray) {
      if (schema && typeof schema === "object" && "$jazz" in schema) {
        const schemaLoaded = await (schema as any).$jazz.ensureLoaded({});
        if (schemaLoaded.$isLoaded && (schemaLoaded as any).name === "Car") {
          console.log("Car schema already exists");
          return; // Car schema already exists
        }
      }
    }
  }

  // Get the owner group from the data list
  const dataOwner = (dataList as any).$jazz?.owner;
  if (!dataOwner) {
    throw new Error("Cannot determine data list owner");
  }

  // Convert JSON Schema to co.map() shape - this creates the typed Car CoMap schema
  const carShape = jsonSchemaToCoMapShape(CarJsonSchema);
  const CarCoMapSchema = co.map(carShape);

  // Create a group for the Car entities list
  const entitiesGroup = Group.create();
  await entitiesGroup.$jazz.waitForSync();

  // Create Car SchemaDefinition with JSON Schema and typed entities list
  const carSchema = SchemaDefinition.create(
    {
      "@schema": "schema-definition",
      name: "Car",
      definition: CarJsonSchema,
      entities: co.list(CarCoMapSchema).create([], entitiesGroup), // Typed with actual Car schema!
    },
    dataOwner
  );
  await carSchema.$jazz.waitForSync();

  // Add Car SchemaDefinition to data list
  dataList.$jazz.push(carSchema);
  await root.$jazz.waitForSync();

  console.log("Car schema created successfully");
}

/**
 * Adds a random Car instance to the Car SchemaDefinition's entities list
 * Creates the Car SchemaDefinition if it doesn't exist
 * 
 * @param account - The Jazz account
 */
export async function addRandomCarInstance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any
): Promise<void> {
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

  // Find Car SchemaDefinition
  let carSchema: any = null;

  if (dataList.$isLoaded) {
    const dataArray = Array.from(dataList);
    for (const schema of dataArray) {
      if (schema && typeof schema === "object" && "$jazz" in schema) {
        const schemaLoaded = await (schema as any).$jazz.ensureLoaded({
          resolve: { entities: true },
        });
        if (schemaLoaded.$isLoaded && (schemaLoaded as any).name === "Car") {
          carSchema = schemaLoaded;
          break;
        }
      }
    }
  }

  // If Car schema doesn't exist, create it first
  if (!carSchema) {
    await migrateAddCars(account);

    // Re-load data list and find Car schema
    const reloadedRoot = await root.$jazz.ensureLoaded({
      resolve: { data: true },
    });
    const reloadedDataList = reloadedRoot.data;

    if (reloadedDataList?.$isLoaded) {
      const dataArray = Array.from(reloadedDataList);
      for (const schema of dataArray) {
        if (schema && typeof schema === "object" && "$jazz" in schema) {
          const schemaLoaded = await (schema as any).$jazz.ensureLoaded({
            resolve: { entities: true },
          });
          if (schemaLoaded.$isLoaded && (schemaLoaded as any).name === "Car") {
            carSchema = schemaLoaded;
            break;
          }
        }
      }
    }

    if (!carSchema) {
      throw new Error("Could not create or find Car schema");
    }
  }

  // Get the entities list from the Car schema
  const entitiesList = carSchema.entities;
  if (!entitiesList) {
    throw new Error("Car schema does not have entities list");
  }

  // Convert JSON Schema to co.map() shape
  const carShape = jsonSchemaToCoMapShape(CarJsonSchema);
  const CarCoMapSchema = co.map(carShape);

  // Generate random car data
  const carNames = [
    "Tesla Model 3",
    "Toyota Camry",
    "Honda Civic",
    "Ford Mustang",
    "BMW 3 Series",
    "Mercedes-Benz C-Class",
    "Audi A4",
    "Volkswagen Golf",
    "Nissan Altima",
    "Chevrolet Malibu",
  ];

  const carColors = [
    "Red",
    "Blue",
    "Green",
    "Black",
    "White",
    "Silver",
    "Gray",
    "Yellow",
    "Orange",
    "Purple",
  ];

  const randomName = carNames[Math.floor(Math.random() * carNames.length)];
  const randomColor = carColors[Math.floor(Math.random() * carColors.length)];

  // Get the owner group from the entities list
  const entitiesOwner = (entitiesList as any).$jazz?.owner;
  if (!entitiesOwner) {
    throw new Error("Cannot determine entities list owner");
  }

  // Create Car instance with properties
  const carInstance = CarCoMapSchema.create(
    {
      name: randomName,
      color: randomColor,
    },
    entitiesOwner
  );
  await carInstance.$jazz.waitForSync();

  // Verify properties are accessible
  if (!carInstance.$isLoaded) {
    await carInstance.$jazz.ensureLoaded({ resolve: {} });
  }

  // Add Car instance to entities list
  entitiesList.$jazz.push(carInstance);
  await root.$jazz.waitForSync();

  console.log(`Added car: ${randomName} (${randomColor})`);
}

/**
 * Resets/clears the data list from root
 * 
 * @param account - The Jazz account
 */
export async function resetData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any
): Promise<void> {
  // Load root
  const loadedAccount = await account.$jazz.ensureLoaded({
    resolve: { root: true },
  });

  if (!loadedAccount.root) {
    throw new Error("Root does not exist");
  }

  const root = loadedAccount.root;

  // Check if data list exists and delete it
  if (root.$jazz.has("data")) {
    root.$jazz.delete("data");
    await root.$jazz.waitForSync();
  }
}

