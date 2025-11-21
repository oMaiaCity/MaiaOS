// Client-side synced query definitions - Projects only
// This file must only be imported on the client side (browser)
// Synced queries require Zero client which is not available during SSR
import { syncedQuery } from '@rocicorp/zero';
import z from 'zod';
import { builder } from './schema';

/**
 * ========================================
 * PROJECT QUERIES
 * ========================================
 */

/**
 * Get all projects, ordered by creation date (newest first)
 */
export const allProjects = syncedQuery(
  'allProjects',
  z.tuple([]), // No arguments needed
  () => {
    return builder.project.orderBy('createdAt', 'desc');
  }
);

/**
 * ========================================
 * SCHEMA QUERIES
 * ========================================
 */

/**
 * Get all schemas
 */
export const allSchemas = syncedQuery(
  'allSchemas',
  z.tuple([]), // No arguments needed
  () => {
    return builder.schema;
  }
);

/**
 * Get a schema by ID
 */
export const schemaById = syncedQuery(
  'schemaById',
  z.tuple([z.string()]), // schemaId
  (schemaId) => {
    return builder.schema.where('id', '=', schemaId);
  }
);

/**
 * ========================================
 * DATA QUERIES
 * ========================================
 */

/**
 * Get all data entries for a specific schema
 */
export const allDataBySchema = syncedQuery(
  'allDataBySchema',
  z.tuple([z.string()]), // schemaId
  (schemaId) => {
    return builder.data.where('schema', '=', schemaId);
  }
);

/**
 * Get a data entry by ID
 */
export const dataById = syncedQuery(
  'dataById',
  z.tuple([z.string()]), // dataId
  (dataId) => {
    return builder.data.where('id', '=', dataId);
  }
);

