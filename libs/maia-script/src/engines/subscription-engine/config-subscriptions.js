function collectEngineSubscription(
  subscriptionEngine,
  actor,
  configKey,
  configCoId,
  engine,
  subscriptionMapKey,
  loadMethod,
  updateHandler,
  engineSubscriptions
) {
  if (!configCoId?.startsWith('co_z') || !engine) return 0;
  const subscriptionMap = engine[subscriptionMapKey];
  const existingSubscription = subscriptionMap?.get(configCoId);
  
  const wrapUnsubscribe = (entry) => {
    if (!actor._subscriptions) actor._subscriptions = [];
    actor._subscriptions.push(() => {
      const current = subscriptionMap?.get(configCoId);
      if (current?.unsubscribe) {
        current.refCount--;
        if (current.refCount <= 0) {
          current.unsubscribe();
          subscriptionMap.delete(configCoId);
        }
      }
    });
  };

  if (existingSubscription?.unsubscribe) {
    engineSubscriptions.push(
      loadMethod.call(engine, configCoId, (updated) => updateHandler.call(subscriptionEngine, actor.id, updated))
        .then((config) => {
          updateHandler.call(subscriptionEngine, actor.id, config);
          existingSubscription.refCount++;
          wrapUnsubscribe(existingSubscription);
          return 1;
        }).catch(() => 0)
    );
    return 0;
  }

  engineSubscriptions.push(
    loadMethod.call(engine, configCoId, (updated) => updateHandler.call(subscriptionEngine, actor.id, updated))
      .then(() => {
        const entry = subscriptionMap?.get(configCoId);
        if (entry?.unsubscribe) {
          entry.refCount = 1;
          wrapUnsubscribe(entry);
          return 1;
        }
        return 0;
      }).catch(() => 0)
  );
  return 0;
}

export async function collectViewStyleStateSubscriptions(subscriptionEngine, actor, config) {
  const engineSubscriptions = [];
  const collect = (key, coId, engine, mapKey, loadMethod, handler) => 
    collectEngineSubscription(subscriptionEngine, actor, key, coId, engine, mapKey, loadMethod, handler, engineSubscriptions);
  
  collect('view', config.view, subscriptionEngine.viewEngine, 'viewSubscriptions', subscriptionEngine.viewEngine?.loadView, subscriptionEngine._handleViewUpdate);
  collect('style', config.style, subscriptionEngine.styleEngine, 'styleSubscriptions', subscriptionEngine.styleEngine?.loadStyle, subscriptionEngine._handleStyleUpdate);
  collect('brand', config.brand, subscriptionEngine.styleEngine, 'styleSubscriptions', subscriptionEngine.styleEngine?.loadStyle, subscriptionEngine._handleStyleUpdate);
  collect('state', config.state, subscriptionEngine.stateEngine, 'stateSubscriptions', subscriptionEngine.stateEngine?.loadStateDef, subscriptionEngine._handleStateUpdate);
  
  return { engineSubscriptions, subscriptionCount: 0 };
}

export async function collectInterfaceContextSubscriptions(subscriptionEngine, actor, config) {
  const subscriptions = [];
  if (config.context?.startsWith('co_z')) {
    try {
      const schemaStore = await subscriptionEngine.dbEngine.execute({ op: 'schema', fromCoValue: config.context });
      const schemaCoId = schemaStore.value?.$id;
      if (schemaCoId) {
        subscriptions.push(
          subscriptionEngine.dbEngine.execute({ op: 'read', schema: schemaCoId, key: config.context })
            .then((store) => {
              const unsubscribe = store.subscribe((updated) => {
                if (updated) {
                  const { $schema, $id, ...context } = updated;
                  subscriptionEngine._handleContextUpdate(actor.id, context);
                }
              });
              if (!actor._subscriptions) actor._subscriptions = [];
              actor._subscriptions.push(unsubscribe);
              return unsubscribe;
            }).catch(() => {})
        );
      }
    } catch (error) {}
  }
  return subscriptions;
}

export async function executeBatchSubscriptions(subscriptionEngine, actor, interfaceContextSubscriptions, engineSubscriptions) {
  if (interfaceContextSubscriptions.length > 0) {
    await Promise.all(interfaceContextSubscriptions).catch(() => {});
  }
  await Promise.all(engineSubscriptions);
  return interfaceContextSubscriptions.length;
}
