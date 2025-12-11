/**
 * Manual migration to add Cars list to root
 * This migration runs only when manually triggered, not automatically
 * 
 * Uses JSON Schema definition and converts it to Jazz Zod schema dynamically
 */

import { co, Group } from "jazz-tools";
import { jsonSchemaToZod } from "../functions/json-schema-to-zod.js";

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
 * Manually adds a Cars list to the root if it doesn't exist
 * Converts JSON Schema to Jazz Zod schema dynamically
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

  // Ensure data list exists (list of schema-specific lists)
  if (!root.$jazz.has("data")) {
    // Create a group for the data list
    const dataGroup = Group.create();
    await dataGroup.$jazz.waitForSync();

    // Create empty data list (list of lists)
    const dataList = co.list(co.list(co.map({}))).create([], dataGroup);
    await dataList.$jazz.waitForSync();

    // Add data list to root
    root.$jazz.set("data", dataList);
    await root.$jazz.waitForSync();
  }

  // Load data list
  const rootWithData = await root.$jazz.ensureLoaded({
    resolve: { data: true },
  });
  const dataList = rootWithData.data;

  if (!dataList) {
    throw new Error("Data list could not be created or loaded");
  }

  // Check if Cars list already exists in data list
  if (dataList && dataList.$isLoaded) {
    const dataArray = Array.from(dataList);
    // If we already have lists, we could check if Cars list exists
    // For now, we'll just create a new Cars list
  }

  // Convert JSON Schema to co.map() shape
  const carShape = jsonSchemaToCoMapShape(CarJsonSchema);

  // Create CoMap schema from shape
  const CarCoMapSchema = co.map(carShape);

  // Create a group for the Cars list
  const carsGroup = Group.create();
  await carsGroup.$jazz.waitForSync();

  // Create empty Cars list (list of Car instances)
  const carsList = co.list(CarCoMapSchema).create([], carsGroup);
  await carsList.$jazz.waitForSync();

  // Get the owner group from the data list
  const dataOwner = (dataList as any).$jazz?.owner;
  if (!dataOwner) {
    throw new Error("Cannot determine data list owner");
  }

  // Add Cars list to data list (nested structure)
  dataList.$jazz.push(carsList);

  // Wait for sync to complete
  await root.$jazz.waitForSync();
}

/**
 * Adds a random Car instance to the Cars list
 * Creates the Cars list if it doesn't exist
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

  // Ensure data list exists (list of schema-specific lists)
  if (!root.$jazz.has("data")) {
    // Create a group for the data list
    const dataGroup = Group.create();
    await dataGroup.$jazz.waitForSync();

    // Create empty data list (list of lists)
    const dataList = co.list(co.list(co.map({}))).create([], dataGroup);
    await dataList.$jazz.waitForSync();

    // Add data list to root
    root.$jazz.set("data", dataList);
    await root.$jazz.waitForSync();
  }

  // Load data list
  const rootWithData = await root.$jazz.ensureLoaded({
    resolve: { data: true },
  });
  const dataList = rootWithData.data;

  if (!dataList) {
    throw new Error("Data list could not be created or loaded");
  }

  // Convert JSON Schema to co.map() shape
  const carShape = jsonSchemaToCoMapShape(CarJsonSchema);
  const CarCoMapSchema = co.map(carShape);

  // Find or create Cars list
  let carsList: any = null;

  if (dataList.$isLoaded) {
    const dataArray = Array.from(dataList);
    // Check if Cars list already exists (first item should be Cars list)
    if (dataArray.length > 0) {
      carsList = dataArray[0];
      // Ensure it's loaded
      if (!carsList.$isLoaded) {
        await carsList.$jazz.ensureLoaded();
      }
    }
  }

  // If Cars list doesn't exist, create it
  if (!carsList) {
    const carsGroup = Group.create();
    await carsGroup.$jazz.waitForSync();

    carsList = co.list(CarCoMapSchema).create([], carsGroup);
    await carsList.$jazz.waitForSync();

    // Add Cars list to data list
    dataList.$jazz.push(carsList);
    await root.$jazz.waitForSync();
  }

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

  // Create a group for the Car instance
  const carGroup = Group.create();
  await carGroup.$jazz.waitForSync();

  // Create Car instance with properties
  const carInstance = CarCoMapSchema.create(
    {
      name: randomName,
      color: randomColor,
    },
    carGroup
  );
  await carInstance.$jazz.waitForSync();

  // Verify properties are accessible (they should be accessible via direct property access)
  // Note: Properties set via create() should be accessible immediately after waitForSync()
  if (!carInstance.$isLoaded) {
    await carInstance.$jazz.ensureLoaded({ resolve: {} });
  }

  // Add Car instance to Cars list
  carsList.$jazz.push(carInstance);
  await root.$jazz.waitForSync();
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

