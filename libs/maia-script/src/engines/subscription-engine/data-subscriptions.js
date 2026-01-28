export async function subscribeToContext(subscriptionEngine, actor) {
  if (!actor.context || typeof actor.context !== 'object') return;
  let subscriptionCount = 0;
  
  for (const [key, value] of Object.entries(actor.context)) {
    if (value?.schema && typeof value.schema === 'string') {
      if (actor._queries?.has(key)) continue;
      
      try {
        let schemaCoId = value.schema;
        if (!schemaCoId.startsWith('co_z')) {
          if (schemaCoId.startsWith('@schema/')) {
            const resolved = await subscriptionEngine.dbEngine.execute({ op: 'resolve', humanReadableKey: schemaCoId });
            if (resolved?.startsWith('co_z')) schemaCoId = resolved;
            else continue;
          } else continue;
        }
        
        const store = await subscriptionEngine.dbEngine.execute({ op: 'read', schema: schemaCoId, filter: value.filter || null });
        
        if (!actor._querySchemaMap) actor._querySchemaMap = new Map();
        if (!actor._queries) actor._queries = new Map();
        if (!actor._querySchemaMap.has(schemaCoId)) actor._querySchemaMap.set(schemaCoId, new Set());
        actor._querySchemaMap.get(schemaCoId).add(key);
        actor._queries.set(key, { schema: schemaCoId, filter: value.filter || null, store });
        
        actor.context[key] = store.value || [];
        if (!actor._initialDataReceived) actor._initialDataReceived = new Set();
        
        const schemaKey = `${key}Schema`;
        if (!actor.context[schemaKey]) actor.context[schemaKey] = schemaCoId;
        const baseMatch = key.match(/^(\w+)(Todo|Done|Active|Completed)?$/i);
        if (baseMatch?.[1]) {
          const baseSchemaKey = `${baseMatch[1].toLowerCase()}Schema`;
          if (!actor.context[baseSchemaKey]) actor.context[baseSchemaKey] = schemaCoId;
        }
        
        const unsubscribe = store.subscribe((data) => handleDataUpdate(subscriptionEngine, actor.id, key, data), { skipInitial: false });
        if (!actor._subscriptions) actor._subscriptions = [];
        actor._subscriptions.push(unsubscribe);
        subscriptionCount++;
      } catch (error) {}
    }
  }
}

export function handleDataUpdate(subscriptionEngine, actorId, contextKey, data) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;
  if (!(contextKey in actor.context)) actor.context[contextKey] = undefined;
  if (data?.schema && !Array.isArray(data)) return;
  
  const existingData = actor.context[contextKey];
  const isInitialData = !actor._initialDataReceived?.has(contextKey);
  const shouldRerender = () => {
    if (actor._initialRenderComplete) subscriptionEngine._scheduleRerender(actorId);
    else actor._needsPostInitRerender = true;
  };
  
  if (existingData === undefined && Array.isArray(data) && data.length === 0) {
    actor.context[contextKey] = data;
    if (!actor._initialDataReceived) actor._initialDataReceived = new Set();
    shouldRerender();
    return;
  }
  
  if (isSameData(existingData, data)) {
    if (isInitialData && data && (Array.isArray(data) ? data.length > 0 : true)) {
      if (!actor._initialDataReceived) actor._initialDataReceived = new Set();
      actor._initialDataReceived.add(contextKey);
      actor.context[contextKey] = data;
      shouldRerender();
    }
    return;
  }
  
  if (isInitialData) {
    actor.context[contextKey] = data;
    if (!actor._initialDataReceived) actor._initialDataReceived = new Set();
    if (data && (Array.isArray(data) ? data.length > 0 : true)) actor._initialDataReceived.add(contextKey);
    shouldRerender();
    return;
  }

  if (isSameData(actor.context[contextKey], data)) return;
  actor.context[contextKey] = data;
  shouldRerender();
}

export function isSameData(oldData, newData) {
  try {
    return JSON.stringify(oldData) === JSON.stringify(newData);
  } catch (e) {
    return false;
  }
}
