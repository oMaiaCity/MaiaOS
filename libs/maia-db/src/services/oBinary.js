import { createSchemaMeta } from "../utils/meta.js";

/**
 * Create a BinaryCoStream with optional schema.
 * @param {RawGroup} group - The group that owns the binary stream
 * @param {string|null} schemaName - Schema name for headerMeta.$schema
 * @returns {RawBinaryCoStream} The created BinaryCoStream
 */
export function createBinaryStream(group, schemaName = null) {
  // Note: cojson has default meta = {type: "binary"}, but we override if schema provided
  const meta = schemaName ? createSchemaMeta(schemaName) : { type: "binary" };
  const binaryStream = group.createBinaryStream(meta);

  console.log("✅ BinaryCoStream created:", binaryStream.id);
  console.log("   Schema:", schemaName);
  console.log("   HeaderMeta:", binaryStream.headerMeta);

  return binaryStream;
}
