/**
 * Interface Validation Tool
 * Validates actor.interface.maia schema against expected format
 * Non-blocking: logs warnings but doesn't throw errors
 */
export default {
  async execute(actor, payload) {
    const { interfaceDef, actorId } = payload;
    
    if (!interfaceDef) {
      console.warn(`[interface/validate] No interface provided for ${actorId}`);
      return;
    }
    
    const errors = [];
    const warnings = [];
    
    // Validate $type
    if (interfaceDef.$type !== 'actor.interface') {
      errors.push('$type must be "actor.interface"');
    }
    
    // Validate inbox (incoming messages)
    if (interfaceDef.inbox) {
      if (typeof interfaceDef.inbox !== 'object') {
        errors.push('inbox must be an object');
      } else {
        for (const [eventName, eventDef] of Object.entries(interfaceDef.inbox)) {
          if (!eventDef.payload) {
            warnings.push(`inbox.${eventName} missing payload schema`);
          }
          if (eventDef.payload && typeof eventDef.payload !== 'object') {
            errors.push(`inbox.${eventName}.payload must be an object`);
          }
        }
      }
    }
    
    // Validate publishes (outgoing messages)
    if (interfaceDef.publishes) {
      if (typeof interfaceDef.publishes !== 'object') {
        errors.push('publishes must be an object');
      } else {
        for (const [eventName, eventDef] of Object.entries(interfaceDef.publishes)) {
          if (!eventDef.payload) {
            warnings.push(`publishes.${eventName} missing payload schema`);
          }
          if (eventDef.payload && typeof eventDef.payload !== 'object') {
            errors.push(`publishes.${eventName}.payload must be an object`);
          }
        }
      }
    }
    
    // Validate subscriptions (array of actor IDs)
    if (interfaceDef.subscriptions) {
      if (!Array.isArray(interfaceDef.subscriptions)) {
        errors.push('subscriptions must be an array');
      } else {
        interfaceDef.subscriptions.forEach((sub, idx) => {
          if (typeof sub !== 'string') {
            errors.push(`subscriptions[${idx}] must be a string (actor ID)`);
          }
        });
      }
    }
    
    // Validate watermark (timestamp)
    if (interfaceDef.watermark !== undefined) {
      if (typeof interfaceDef.watermark !== 'number') {
        errors.push('watermark must be a number (timestamp)');
      }
    }
    
    // Log results
    if (errors.length > 0) {
      console.error(`❌ [interface/validate] ${actorId} - Validation errors:`, errors);
    }
    
    if (warnings.length > 0) {
      console.warn(`⚠️ [interface/validate] ${actorId} - Validation warnings:`, warnings);
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✅ [interface/validate] ${actorId} - Interface valid`);
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
