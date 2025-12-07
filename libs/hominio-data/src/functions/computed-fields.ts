/**
 * Generic Computed Fields System for Jazz CoValues
 * 
 * Provides a robust, type-safe way to define computed fields that automatically
 * sync based on source field changes, with safeguards to prevent infinite loops.
 */

// WeakMap to track which CoValues have had computed fields set up
// This avoids storing metadata directly on Proxy objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const computedFieldsSetupMap = new WeakMap<any, Set<string>>();

// WeakMap to track update-in-progress flags to prevent infinite loops
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateInProgressMap = new WeakMap<any, Set<string>>();

// WeakMap to store last known values for each CoValue (for change detection)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastValuesMap = new WeakMap<any, Map<string, Map<string, any>>>();

/**
 * Definition for a computed field
 */
export interface ComputedFieldDef {
  /** Target field to compute (e.g., "@label") */
  targetField: string;
  /** Source fields to watch (e.g., ["avatar.firstName", "avatar.lastName"]) */
  sourceFields: string[];
  /** Computation function that takes the CoValue and returns the computed value */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeFn: (coValue: any) => any;
  /** Optional: only apply to specific schema types (e.g., "human") */
  schemaType?: string;
}

/**
 * Registry for computed field definitions
 */
class ComputedFieldRegistry {
  private definitions: ComputedFieldDef[] = [];
  private dependencyGraph: Map<string, Set<string>> = new Map();

  /**
   * Register a computed field definition
   */
  register(def: ComputedFieldDef): void {
    // Check for circular dependencies
    this.checkCircularDependency(def.targetField, def.sourceFields);

    // Build dependency graph
    if (!this.dependencyGraph.has(def.targetField)) {
      this.dependencyGraph.set(def.targetField, new Set());
    }
    def.sourceFields.forEach(sourceField => {
      this.dependencyGraph.get(def.targetField)!.add(sourceField);
    });

    this.definitions.push(def);
  }

  /**
   * Get all computed field definitions that apply to a given CoValue
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDefinitionsForCoValue(coValue: any): ComputedFieldDef[] {
    if (!coValue || !coValue.$isLoaded) {
      return [];
    }

    // Get schema type if available
    const schemaType = coValue.$jazz.has("@schema") ? coValue["@schema"] : undefined;

    return this.definitions.filter(def => {
      // If schemaType is specified, only apply to matching schemas
      if (def.schemaType && def.schemaType !== schemaType) {
        return false;
      }
      return true;
    });
  }

  /**
   * Check for circular dependencies in the dependency graph
   */
  private checkCircularDependency(targetField: string, sourceFields: string[]): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const hasCycle = (field: string): boolean => {
      if (visiting.has(field)) {
        return true; // Cycle detected
      }
      if (visited.has(field)) {
        return false; // Already checked, no cycle
      }

      visiting.add(field);

      // Check if this field is computed and depends on other fields
      const dependsOn = this.dependencyGraph.get(field);
      if (dependsOn) {
        for (const dep of dependsOn) {
          if (hasCycle(dep)) {
            return true;
          }
        }
      }

      visiting.delete(field);
      visited.add(field);
      return false;
    };

    // Check if any source field would create a cycle
    for (const sourceField of sourceFields) {
      if (hasCycle(sourceField)) {
        throw new Error(
          `Circular dependency detected: ${targetField} depends on ${sourceField}, ` +
          `which eventually depends on ${targetField}`
        );
      }
    }
  }
}

// Global registry instance
const registry = new ComputedFieldRegistry();

/**
 * Register a computed field definition
 */
export function registerComputedField(def: ComputedFieldDef): void {
  registry.register(def);
}

/**
 * Check if a field is computed for a given CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isComputedField(coValue: any, fieldName: string): boolean {
  if (!coValue || !coValue.$isLoaded) {
    return false;
  }
  
  const setupFields = computedFieldsSetupMap.get(coValue);
  return setupFields ? setupFields.has(fieldName) : false;
}

/**
 * Get a nested field value from a CoValue using dot notation
 * (e.g., "avatar.firstName" -> coValue.avatar.firstName)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedField(coValue: any, fieldPath: string): any {
  const parts = fieldPath.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = coValue;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Check if any source fields have changed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasSourceFieldsChanged(coValue: any, def: ComputedFieldDef, lastValues: Map<string, any>): boolean {
  for (const sourceField of def.sourceFields) {
    const currentValue = getNestedField(coValue, sourceField);
    const lastValue = lastValues.get(sourceField);

    // Compare values (handling undefined/null)
    if (currentValue !== lastValue) {
      return true;
    }
  }
  return false;
}

/**
 * Set up computed fields for a CoValue
 * This should be called during migrations or when a CoValue is first loaded
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupComputedFieldsForCoValue(coValue: any): void {
  if (!coValue || !coValue.$isLoaded) {
    return;
  }

  // Get all applicable computed field definitions
  const definitions = registry.getDefinitionsForCoValue(coValue);

  if (definitions.length === 0) {
    return;
  }

  // Track which fields have been set up for this CoValue
  let setupFields = computedFieldsSetupMap.get(coValue);
  if (!setupFields) {
    setupFields = new Set<string>();
    computedFieldsSetupMap.set(coValue, setupFields);
  }

  // Get or create last known values map for this CoValue
  let lastValuesByField = lastValuesMap.get(coValue);
  if (!lastValuesByField) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lastValuesByField = new Map<string, Map<string, any>>();
    lastValuesMap.set(coValue, lastValuesByField);
  }

  // Initialize last values for each definition
  definitions.forEach(def => {
    let lastValues = lastValuesByField.get(def.targetField);
    if (!lastValues) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastValues = new Map<string, any>();
      lastValuesByField.set(def.targetField, lastValues);
    }

    // Initialize last values for source fields
    def.sourceFields.forEach(sourceField => {
      if (!lastValues.has(sourceField)) {
        lastValues.set(sourceField, getNestedField(coValue, sourceField));
      }
    });
  });

  // Set up each computed field
  for (const def of definitions) {
    // Get last values for this field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastValues = lastValuesByField.get(def.targetField) || (new Map<string, any>() as Map<string, any>);

    // Skip if already set up
    if (setupFields.has(def.targetField)) {
      // Still update the computed value in case source fields changed
      updateComputedField(coValue, def, lastValues);
      continue;
    }

    // Compute initial value
    try {
      const computedValue = def.computeFn(coValue);
      const currentValue = coValue.$jazz.has(def.targetField) ? coValue[def.targetField] : undefined;

      // Only update if value actually changed
      if (computedValue !== currentValue) {
        coValue.$jazz.set(def.targetField, computedValue);
      }
    } catch (error) {
      console.warn(`[ComputedFields] Error computing ${def.targetField}:`, error);
    }

    // Set up subscription for reactive updates
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (coValue.$jazz as any).subscribe({}, (updated: any) => {
        if (!updated || !updated.$isLoaded) {
          return;
        }

        // Check if update is already in progress for this field (prevent loops)
        let updateInProgress = updateInProgressMap.get(updated);
        if (!updateInProgress) {
          updateInProgress = new Set<string>();
          updateInProgressMap.set(updated, updateInProgress);
        }

        if (updateInProgress.has(def.targetField)) {
          return; // Already updating, prevent loop
        }

        // Get last values for this field from the WeakMap
        const lastValuesForField = lastValuesMap.get(updated)?.get(def.targetField);
        if (!lastValuesForField) {
          return; // No last values stored, skip (shouldn't happen)
        }

        // Check if source fields have changed
        if (!hasSourceFieldsChanged(updated, def, lastValuesForField)) {
          return; // No change, skip update
        }

        // Mark as updating
        updateInProgress.add(def.targetField);

        try {
          // Compute new value
          const newValue = def.computeFn(updated);
          const currentValue = updated.$jazz.has(def.targetField) ? updated[def.targetField] : undefined;

          // Only update if value actually changed
          if (newValue !== currentValue) {
            updated.$jazz.set(def.targetField, newValue);
          }

          // Update last known values
          def.sourceFields.forEach(sourceField => {
            lastValuesForField.set(sourceField, getNestedField(updated, sourceField));
          });
        } catch (error) {
          console.warn(`[ComputedFields] Error updating ${def.targetField}:`, error);
        } finally {
          // Remove update flag
          updateInProgress.delete(def.targetField);
        }
      });

      // Store unsubscribe function (though we may not need it if CoValue is cleaned up)
      // Note: Jazz should handle cleanup automatically when CoValue is no longer referenced
    } catch (error) {
      console.warn(`[ComputedFields] Error setting up subscription for ${def.targetField}:`, error);
    }

    // Mark as set up
    setupFields.add(def.targetField);
  }
}

/**
 * Update a single computed field (used when source fields may have changed)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateComputedField(coValue: any, def: ComputedFieldDef, lastValues: Map<string, any>): void {
  // Check if update is already in progress (prevent loops)
  let updateInProgress = updateInProgressMap.get(coValue);
  if (!updateInProgress) {
    updateInProgress = new Set<string>();
    updateInProgressMap.set(coValue, updateInProgress);
  }

  if (updateInProgress.has(def.targetField)) {
    return; // Already updating, prevent loop
  }

  // Check if source fields have changed
  if (!hasSourceFieldsChanged(coValue, def, lastValues)) {
    return; // No change, skip update
  }

  // Mark as updating
  updateInProgress.add(def.targetField);

  try {
    // Compute new value
    const newValue = def.computeFn(coValue);
    const currentValue = coValue.$jazz.has(def.targetField) ? coValue[def.targetField] : undefined;

    // Only update if value actually changed
    if (newValue !== currentValue) {
      coValue.$jazz.set(def.targetField, newValue);
    }

    // Update last known values
    def.sourceFields.forEach(sourceField => {
      lastValues.set(sourceField, getNestedField(coValue, sourceField));
    });
  } catch (error) {
    console.warn(`[ComputedFields] Error updating ${def.targetField}:`, error);
  } finally {
    // Remove update flag
    updateInProgress.delete(def.targetField);
  }
}


