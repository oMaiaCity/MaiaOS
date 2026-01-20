/**
 * Shared Validation Engine Singleton
 * 
 * Provides a single shared instance of CoSchemaValidationEngine
 * to avoid duplicate schema registrations across multiple service files
 */

import { CoSchemaValidationEngine } from './validation.js';

let sharedValidationEngine = null;
let initializationPromise = null;

/**
 * Get the shared validation engine instance
 * @returns {Promise<CoSchemaValidationEngine>}
 */
export async function getSharedValidationEngine() {
  if (sharedValidationEngine) {
    return sharedValidationEngine;
  }
  
  if (initializationPromise) {
    await initializationPromise;
    return sharedValidationEngine;
  }
  
  initializationPromise = (async () => {
    sharedValidationEngine = new CoSchemaValidationEngine();
    await sharedValidationEngine.initialize();
    await sharedValidationEngine.registerAllSchemas();
  })();
  
  await initializationPromise;
  return sharedValidationEngine;
}
