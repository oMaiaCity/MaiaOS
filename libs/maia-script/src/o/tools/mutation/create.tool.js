/**
 * Generic Create Tool
 * Creates a new entity in the specified schema collection
 * Uses ReactiveStore for persistence and automatic observer notifications
 */
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    
    if (!schema || !data) {
      throw new Error('@mutation/create requires schema and data');
    }
    
    const store = actor.actorEngine.reactiveStore;
    if (!store) {
      throw new Error('ReactiveStore not initialized in ActorEngine');
    }
    
    // Generate ID and create entity
    const entity = {
      id: Date.now().toString(),
      ...data
    };
    
    // Get current collection and add new entity
    const collection = store.getCollection(schema);
    collection.push(entity);
    
    // Save to ReactiveStore (triggers observer notifications automatically)
    store.setCollection(schema, collection);
    
    // Store created entity in context for state machine access
    actor.context.lastCreatedEntity = entity;
    actor.context.lastCreatedId = entity.id;
    actor.context.lastCreatedText = entity.text || '';
    
    console.log(`✅ [mutation/create] Created ${schema}:`, entity);
    
    return entity;
  }
};
