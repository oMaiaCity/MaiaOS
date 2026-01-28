export function handleViewUpdate(subscriptionEngine, actorId, newViewDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;
  actor.viewDef = newViewDef;
  if (actor._initialRenderComplete) subscriptionEngine._scheduleRerender(actorId);
}

export async function handleStyleUpdate(subscriptionEngine, actorId, newStyleDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;
  try {
    actor.shadowRoot.adoptedStyleSheets = await subscriptionEngine.styleEngine.getStyleSheets(actor.config);
    if (actor._initialRenderComplete) subscriptionEngine._scheduleRerender(actorId);
  } catch (error) {}
}

export async function handleStateUpdate(subscriptionEngine, actorId, newStateDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor || !subscriptionEngine.stateEngine) return;
  try {
    if (actor.machine) subscriptionEngine.stateEngine.destroyMachine(actor.machine.id);
    actor.machine = await subscriptionEngine.stateEngine.createMachine(newStateDef, actor);
    if (actor._initialRenderComplete) subscriptionEngine._scheduleRerender(actorId);
  } catch (error) {}
}

export async function handleInterfaceUpdate(subscriptionEngine, actorId, newInterfaceDef) {}

export async function handleContextUpdate(subscriptionEngine, actorId, newContext) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;
  const merged = { ...actor.context };
  for (const [key, value] of Object.entries(newContext)) {
    const existing = actor.context[key];
    if (Array.isArray(existing) && value?.schema && !Array.isArray(value)) continue;
    merged[key] = value;
  }
  actor.context = merged;
  const { subscribeToContext } = await import('./data-subscriptions.js');
  await subscribeToContext(subscriptionEngine, actor);
  if (actor._initialRenderComplete) subscriptionEngine._scheduleRerender(actorId);
}
