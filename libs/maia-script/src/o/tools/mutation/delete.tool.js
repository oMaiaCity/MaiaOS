/**
 * Generic Delete Tool
 * Deletes an entity from the specified schema collection
 * Uses ReactiveStore for persistence and automatic observer notifications
 */
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    if (!schema || !id) {
      throw new Error('@mutation/delete requires schema and id');
    }
    
    const store = actor.actorEngine.reactiveStore;
    if (!store) {
      throw new Error('ReactiveStore not initialized in ActorEngine');
    }
    
    // Get collection and find entity
    const collection = store.getCollection(schema);
    const index = collection.findIndex(item => item.id === id);
    
    if (index === -1) {
      console.warn(`Entity ${id} not found in ${schema}`);
      return;
    }
    
    // Remove entity
    collection.splice(index, 1);
    
    // Save to ReactiveStore (triggers observer notifications automatically)
    store.setCollection(schema, collection);
    
    console.log(`✅ [mutation/delete] Deleted ${schema}/${id}`);
    
    return { id };
  }
};
