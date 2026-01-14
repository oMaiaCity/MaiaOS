/**
 * Generic Update Tool
 * Updates an entity in the specified schema collection
 * Uses ReactiveStore for persistence and automatic observer notifications
 */
export default {
  async execute(actor, payload) {
    const { schema, id, data } = payload;
    
    if (!schema || !id || !data) {
      throw new Error('@mutation/update requires schema, id, and data');
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
    
    // Merge update data
    Object.assign(entity, data);
    
    // Save to ReactiveStore (triggers observer notifications automatically)
    store.setCollection(schema, collection);
    
    console.log(`✅ [mutation/update] Updated ${schema}/${id}:`, entity);
    
    return entity;
  }
};
