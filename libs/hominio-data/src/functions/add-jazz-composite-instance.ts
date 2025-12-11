/**
 * Creates a hardcoded JazzComposite instance
 * Demonstrates proper instantiation of all Jazz types
 */

import { co, z, Group } from "jazz-tools";
import { ensureSchema } from "./dynamic-schema-migration.js";
import { jsonSchemaToZod } from "./json-schema-to-zod.js";
import { JazzCompositeJsonSchema } from "../schemas/jazz-composite-schema.js";

/**
 * Creates a hardcoded JazzComposite instance with example values for all types
 * 
 * @param account - The Jazz account
 * @returns The created JazzComposite instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addJazzCompositeInstance(account: any): Promise<any> {
  // Ensure schema exists (creates if needed)
  const schema = await ensureSchema(account, "JazzComposite", JazzCompositeJsonSchema);

  // Get the entities list
  const entitiesList = schema.entities;
  if (!entitiesList) {
    throw new Error("JazzComposite schema does not have entities list");
  }

  // Convert JSON Schema to co.map() shape
  const shape: Record<string, any> = {};
  const required = JazzCompositeJsonSchema.required || [];

  for (const [key, value] of Object.entries(JazzCompositeJsonSchema.properties)) {
    const isOptional = !required.includes(key);
    shape[key] = jsonSchemaToZod(value as any, isOptional);
  }

  const entityShape = co.map(shape);

  // Get the owner group from the entities list
  // Use this SAME group for ALL nested CoValues to ensure they're accessible
  const entitiesOwner = (entitiesList as any).$jazz?.owner;
  if (!entitiesOwner) {
    throw new Error("Cannot determine entities list owner");
  }

  // Create CoValue instances - use the SAME owner group for all nested CoValues
  // This ensures they're accessible from the parent entity
  const nestedCoMap = co.map({
    nestedString: z.string(),
    nestedNumber: z.number(),
    nestedBoolean: z.boolean(),
  }).create(
    {
      nestedString: "Nested string value",
      nestedNumber: 42,
      nestedBoolean: true,
    },
    { owner: entitiesOwner }
  );
  await nestedCoMap.$jazz.waitForSync();

  // Create CoList instances
  const coListOfStrings = co.list(z.string()).create(
    ["item1", "item2", "item3"],
    { owner: entitiesOwner }
  );
  await coListOfStrings.$jazz.waitForSync();

  const coListOfNumbers = co.list(z.number()).create(
    [1, 2, 3, 4, 5],
    { owner: entitiesOwner }
  );
  await coListOfNumbers.$jazz.waitForSync();

  // Create CoList of CoMaps
  const item1 = co.map({
    itemName: z.string(),
    itemValue: z.number(),
  }).create({ itemName: "Item 1", itemValue: 10 }, { owner: entitiesOwner });
  await item1.$jazz.waitForSync();
  const item2 = co.map({
    itemName: z.string(),
    itemValue: z.number(),
  }).create({ itemName: "Item 2", itemValue: 20 }, { owner: entitiesOwner });
  await item2.$jazz.waitForSync();
  const coListOfCoMaps = co.list(co.map({
    itemName: z.string(),
    itemValue: z.number(),
  })).create([item1, item2], { owner: entitiesOwner });
  await coListOfCoMaps.$jazz.waitForSync();

  // Create CoFeed
  const coFeed = co.feed(z.string()).create([], { owner: entitiesOwner });
  await coFeed.$jazz.waitForSync();
  // Add some feed items
  coFeed.$jazz.push("Feed item 1");
  coFeed.$jazz.push("Feed item 2");
  await coFeed.$jazz.waitForSync();

  // Create CoPlainText and CoRichText (these are created synchronously, no waitForSync needed)
  const coPlainText = co.plainText().create("This is plain text content.", { owner: entitiesOwner });
  const coRichText = co.richText().create("<p>This is <b>rich text</b> content.</p>", { owner: entitiesOwner });

  // Create nested structure CoMap
  const innerList = co.list(z.string()).create(["nested1", "nested2"], { owner: entitiesOwner });
  await innerList.$jazz.waitForSync();

  const innerFeed = co.feed(z.number()).create([], { owner: entitiesOwner });
  await innerFeed.$jazz.waitForSync();
  innerFeed.$jazz.push(100);
  innerFeed.$jazz.push(200);
  await innerFeed.$jazz.waitForSync();

  const innerCoMap = co.map({
    deepString: z.string(),
  }).create({ deepString: "Deep nested string" }, { owner: entitiesOwner });
  await innerCoMap.$jazz.waitForSync();

  const nestedStructure = co.map({
    innerList: co.list(z.string()),
    innerFeed: co.feed(z.number()),
    innerCoMap: co.map({
      deepString: z.string(),
    }),
  }).create(
    {
      innerList,
      innerFeed,
      innerCoMap,
    },
    { owner: entitiesOwner }
  );
  await nestedStructure.$jazz.waitForSync();

  // Create optional CoMap
  const optionalCoMap = co.map({
    optionalField: z.string(),
  }).create({ optionalField: "Optional CoMap field" }, { owner: entitiesOwner });
  await optionalCoMap.$jazz.waitForSync();

  // Create optional CoList
  const optionalCoList = co.list(z.string()).create(["optional1", "optional2"], { owner: entitiesOwner });
  await optionalCoList.$jazz.waitForSync();

  // Create optional CoFeed
  const optionalCoFeed = co.feed(z.string()).create([], { owner: entitiesOwner });
  await optionalCoFeed.$jazz.waitForSync();
  optionalCoFeed.$jazz.push("Optional feed item");
  await optionalCoFeed.$jazz.waitForSync();

  // Create the main entity instance
  // Note: For FileStreams and Images, we'll skip them for now as they require blob data
  // The schema allows them to be optional, so we can omit them
  const entityInstance = entityShape.create(
    {
      // Primitives
      stringValue: "Hello Jazz!",
      numberValue: 123.45,
      booleanValue: true,
      dateValue: new Date(),
      enumValue: "option1",

      // Passthrough object
      passthroughObject: {
        id: "some-id-123",
        metadata: {
          createdAt: new Date().toISOString(),
          tags: ["tag1", "tag2", "tag3"],
        },
      },

      // CoValues
      nestedCoMap,
      coListOfStrings,
      coListOfNumbers,
      coListOfCoMaps,
      coFeed,
      // coImage: skipped (requires blob)
      // coFileStream: skipped (requires blob)
      coPlainText,
      coRichText,

      // Optional primitives
      optionalString: "I am optional",
      optionalNumber: 999,

      // Optional CoValues
      optionalCoMap,
      optionalCoList,
      optionalCoFeed,
      // optionalCoImage: skipped
      // optionalCoFileStream: skipped

      // Nested structure
      nestedStructure,
    },
    { owner: entitiesOwner }
  );
  await entityInstance.$jazz.waitForSync();

  // Add entity instance to entities list
  entitiesList.$jazz.push(entityInstance);
  await account.$jazz.ensureLoaded({ resolve: { root: true } });
  
  // Note: The entity's nested CoValue properties are already created and linked
  // They will be loaded when navigating to the entity in the data explorer

  return entityInstance;
}

