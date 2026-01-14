/**
 * Generic Toggle Tool
 * Toggles a boolean field on an entity
 * Uses ReactiveStore for persistence and automatic observer notifications
 */
export default {
  async execute(actor, payload) {
    const { schema, id, field = 'done' } = payload;
    
    if (!schema || !id) {
      throw new Error('@mutation/toggle requires schema and id');
    }
    
    const store = actor.actorEngine.reactiveStore;
    if (!store) {
      throw new Error('ReactiveStore not initialized in ActorEngine');
    }
    
    // Get collection and find entity
    const collection = store.getCollection(schema);
    const entity = collection.find(item => item.id === id);
    
    if (!entity) {
      console.warn(`Entity ${id} not found in ${schema}`);
      return;
    }
    
    // Toggle the field
    entity[field] = !entity[field];
    
    // Save to ReactiveStore (triggers observer notifications automatically)
    store.setCollection(schema, collection);
    
    console.log(`✅ [mutation/toggle] Toggled ${schema}/${id}.${field}:`, entity[field]);
    
    return entity;
  }
};
