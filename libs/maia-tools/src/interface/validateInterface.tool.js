/**
 * Interface Validation Tool
 * Validates actor.interface.maia schema against expected format
 * Non-blocking: logs warnings but doesn't throw errors
 */
import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

export default {
  async execute(actor, payload) {
    const { interfaceDef, actorId } = payload;
    
    if (!interfaceDef) {
      console.warn(`[interface/validate] No interface provided for ${actorId}`);
      return;
    }
    
    // Debug: Log the actual structure of inbox and publishes
    if (interfaceDef.inbox) {
      console.log(`[interface/validate] ${actorId} - inbox type: ${typeof interfaceDef.inbox}, isArray: ${Array.isArray(interfaceDef.inbox)}, keys: ${interfaceDef.inbox && typeof interfaceDef.inbox === 'object' ? Object.keys(interfaceDef.inbox).length : 'N/A'}`);
    }
    if (interfaceDef.publishes) {
      console.log(`[interface/validate] ${actorId} - publishes type: ${typeof interfaceDef.publishes}, isArray: ${Array.isArray(interfaceDef.publishes)}, keys: ${interfaceDef.publishes && typeof interfaceDef.publishes === 'object' ? Object.keys(interfaceDef.publishes).length : 'N/A'}`);
    }
    
    const errors = [];
    const warnings = [];
    
    // Validate $schema (replaces legacy $type)
    if (interfaceDef.$schema && !interfaceDef.$schema.startsWith('@schema/interface') && !interfaceDef.$schema.startsWith('co_z')) {
      warnings.push(`$schema should reference @schema/interface or a co-id, got: ${interfaceDef.$schema}`);
    }
    
    // Validate inbox (incoming messages)
    if (interfaceDef.inbox) {
      // Handle case where inbox might be an array (CoJSON conversion issue)
      if (Array.isArray(interfaceDef.inbox)) {
        console.warn(`[interface/validate] ${actorId} - inbox is an array, attempting to convert to object`);
        // Try to convert array to object (in case it's in properties array format)
        const convertedInbox = {};
        for (const item of interfaceDef.inbox) {
          if (item && typeof item === 'object' && item.key !== undefined) {
            convertedInbox[item.key] = item.value;
          }
        }
        if (Object.keys(convertedInbox).length > 0) {
          interfaceDef.inbox = convertedInbox;
          warnings.push('inbox was converted from array to object');
        } else {
          errors.push('inbox must be an object (not an array)');
        }
      }
      
      if (typeof interfaceDef.inbox !== 'object' || Array.isArray(interfaceDef.inbox)) {
        errors.push('inbox must be an object (not an array)');
      } else {
        for (const [eventName, eventDef] of Object.entries(interfaceDef.inbox)) {
          if (!eventDef.payload) {
            warnings.push(`inbox.${eventName} missing payload schema`);
          }
          if (eventDef.payload && typeof eventDef.payload !== 'object') {
            errors.push(`inbox.${eventName}.payload must be an object, got: ${typeof eventDef.payload}`);
          }
          // Check for extra properties (violates additionalProperties: false)
          const allowedProps = ['payload'];
          const extraProps = Object.keys(eventDef).filter(key => !allowedProps.includes(key));
          if (extraProps.length > 0) {
            errors.push(`inbox.${eventName} has extra properties not allowed: ${extraProps.join(', ')}. Only 'payload' is allowed.`);
          }
        }
      }
    }
    
    // Validate publishes (outgoing messages)
    if (interfaceDef.publishes) {
      // Handle case where publishes might be an array (CoJSON conversion issue)
      if (Array.isArray(interfaceDef.publishes)) {
        console.warn(`[interface/validate] ${actorId} - publishes is an array, attempting to convert to object`);
        // Try to convert array to object (in case it's in properties array format)
        const convertedPublishes = {};
        for (const item of interfaceDef.publishes) {
          if (item && typeof item === 'object' && item.key !== undefined) {
            convertedPublishes[item.key] = item.value;
          }
        }
        if (Object.keys(convertedPublishes).length > 0) {
          interfaceDef.publishes = convertedPublishes;
          warnings.push('publishes was converted from array to object');
        } else {
          errors.push('publishes must be an object (not an array)');
        }
      }
      
      if (typeof interfaceDef.publishes !== 'object' || Array.isArray(interfaceDef.publishes)) {
        errors.push('publishes must be an object (not an array)');
      } else {
        for (const [eventName, eventDef] of Object.entries(interfaceDef.publishes)) {
          if (!eventDef.payload) {
            warnings.push(`publishes.${eventName} missing payload schema`);
          }
          if (eventDef.payload && typeof eventDef.payload !== 'object') {
            errors.push(`publishes.${eventName}.payload must be an object, got: ${typeof eventDef.payload}`);
          }
          // Check for extra properties (violates additionalProperties: false)
          const allowedProps = ['payload'];
          const extraProps = Object.keys(eventDef).filter(key => !allowedProps.includes(key));
          if (extraProps.length > 0) {
            errors.push(`publishes.${eventName} has extra properties not allowed: ${extraProps.join(', ')}. Only 'payload' is allowed.`);
          }
        }
      }
    }
    
    // Also validate against JSON Schema if dbEngine is available
    // Use fromCoValue pattern to extract schema from interface CoValue's headerMeta
    if (actor.actorEngine?.dbEngine && interfaceDef.$id) {
      try {
        // Extract schema from interface CoValue's headerMeta using fromCoValue pattern
        const interfaceSchema = await loadSchemaFromDB(actor.actorEngine.dbEngine, { fromCoValue: interfaceDef.$id });
        if (interfaceSchema) {
          const schemaValidation = await validateAgainstSchema(interfaceSchema, interfaceDef, `interface validation for ${actorId}`);
          if (!schemaValidation.valid && schemaValidation.errors) {
            // Add JSON Schema validation errors
            for (const error of schemaValidation.errors) {
              errors.push(`JSON Schema: ${error.message || JSON.stringify(error)}`);
            }
          }
        }
      } catch (error) {
        // Don't fail if schema loading fails - just log warning
        warnings.push(`Could not validate against JSON Schema: ${error.message}`);
      }
    }
    
    // Note: subscriptions and watermark are now in actor.maia files, not interface files
    // Interface files only define API contracts (inbox/publishes message schemas)
    
    // Log results
    if (errors.length > 0) {
      console.error(`❌ [interface/validate] ${actorId} - Validation errors:`, errors);
      // Log each error separately for better visibility
      errors.forEach((error, index) => {
        console.error(`   Error ${index + 1}: ${error}`);
      });
    }
    
    if (warnings.length > 0) {
      console.warn(`⚠️ [interface/validate] ${actorId} - Validation warnings:`, warnings);
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      // Silent - only log errors
    }
    
    // Store validation results in actor context (for debugging)
    if (!actor.context._interfaceValidation) {
      actor.context._interfaceValidation = {};
    }
    
    actor.context._interfaceValidation = {
      valid: errors.length === 0,
      errors,
      warnings,
      timestamp: Date.now()
    };
  }
};
