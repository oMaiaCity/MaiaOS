<!--
  ActorRenderer Component
  JAZZ-NATIVE ARCHITECTURE - Pure CoState reactivity
  Skills called directly on actor, no dataStore
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { CoState } from "jazz-tools/svelte";
  import { Actor, ActorMessage } from "@maia/db";
  import { registerAllSkills, skillRegistry } from "../skills";
  import { resolveDataPath } from "../view/resolver";
  import { useQuery } from "../useQuery.svelte";
  import Composite from "../view/Composite.svelte";
  import Leaf from "../view/Leaf.svelte";
  import { createActorLogger } from "../utilities/logger";
  
  interface Props {
    actorId: string; // Actor's CoValue ID
    accountCoState?: any; // Global account (for skills)
    itemDependencyId?: string; // For foreach: CoValue ID of item (deprecated)
    item?: any; // For foreach: actual item object
  }
  
  const { actorId, accountCoState, itemDependencyId, item: itemProp }: Props = $props();
  
  // Create actor-specific logger (will be initialized once actor loads)
  let logger = $derived.by(() => createActorLogger(actor));
  
  // Register skills once
  if (browser) registerAllSkills();
  
  // ============================================
  // JAZZ-NATIVE REACTIVE ACTOR LOADING
  // ============================================
  
  // Load actor - Jazz CoState handles reactivity
  // In Svelte 5, props are reactive. Use $derived.by to ensure CoState is recreated when actorId changes.
  const actorCoState = $derived.by(() => new CoState(Actor, actorId));
  const actor = $derived(actorCoState.current);
  
  // Item is passed directly from foreach loop (already loaded)
  const item = $derived(itemProp);
  
  // ============================================
  // VISIBILITY CHECK (Jazz-native)
  // ============================================
  
  // Check actor.context.visible flag (default: false, actors must opt-in to be visible)
  const isVisible = $derived.by(() => {
    if (!actor?.$isLoaded) return false;
    const context = (actor as any).context;
    // Default is FALSE - actors must explicitly set visible: true to render
    return context?.visible === true;
  });
  
  // Get schemaName from actor's queries context (useQuery approach from staged changes)
  const schemaName = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.context) return '';
    const context = actor.context as any;
    const queries = context.queries;
    if (!queries || typeof queries !== 'object') return '';
    // Get first query's schemaName (assumption: one query per actor for now)
    const firstQuery = Object.values(queries)[0] as any;
    return firstQuery?.schemaName || '';
  });
  
  // Use useQuery to get filtered entities (handles schema matching via Jazz snapshots)
  const queryResult = useQuery(() => accountCoState, () => schemaName, undefined);
  
  // Populate actor.context.queries with entities from useQuery
  // This updates queries reactively as entities change
  // IMPORTANT: Don't mutate Jazz context here - just read it for data resolution
  const resolvedContextWithQueries = $derived.by(() => {
    if (!actor?.$isLoaded) return {};
    
    const context = (actor as any).context;
    if (!context || typeof context !== 'object') return context;
    
    const queries = context?.queries;
    if (!queries || typeof queries !== 'object') return context;
    
    // Create a new context object with populated query results
    // This doesn't mutate the Jazz context, just creates a derived view
    const resolvedQueries: Record<string, any> = {};
    
    for (const [queryKey, queryConfig] of Object.entries(queries)) {
      const config = queryConfig as any;
      if (config?.schemaName && queryResult.entities) {
        resolvedQueries[queryKey] = {
          ...config,
          items: queryResult.entities, // Plain objects with accessible properties
        };
      } else {
        resolvedQueries[queryKey] = config;
      }
    }
    
    return {
      ...context,
      queries: resolvedQueries,
    };
  });
  
  // ============================================
  // MESSAGE CONSUMPTION TRACKING
  // ============================================
  // PROPER COFEED PATTERN: Track consumed messages in actor context
  // CoFeeds are append-only - we can't delete messages
  // Instead, we track which messages have been consumed to prevent replay
  
  // Load consumed message IDs from actor context (persists across reloads)
  const loadConsumedIds = () => {
    if (!actor?.$isLoaded) return new Set<string>();
    const context = actor.context as any;
    const consumed = context?.consumedMessages || [];
    return new Set<string>(consumed);
  };
  
  // Track consumed message IDs in memory (synced with Jazz context)
  let consumedMessageIds = $state<Set<string>>(new Set());
  
  // Load consumed IDs when actor loads
  $effect(() => {
    if (actor?.$isLoaded) {
      consumedMessageIds = loadConsumedIds();
    }
  });
  
  // ============================================
  // MESSAGE PROCESSING - CALL SKILLS DIRECTLY
  // ============================================
  
  // Process ALL unconsumed messages in the inbox
  // Call skills directly with actor reference (no dataStore)
  $effect(() => {
    if (!actor?.$isLoaded || !browser) return;
    const inbox = actor.inbox;
    if (!inbox?.$isLoaded) return;
    
    // Collect ALL messages from the inbox (byMe and perAccount)
    const allMessages: any[] = [];
    
    // Get byMe messages
    const byMeMessage = inbox.byMe?.value;
    if (byMeMessage?.$isLoaded) {
      allMessages.push(byMeMessage);
    }
    
    // Get perAccount messages
    if (inbox.perAccount) {
      for (const accountId in inbox.perAccount) {
        const accountFeed = inbox.perAccount[accountId];
        if (accountFeed?.value?.$isLoaded) {
          allMessages.push(accountFeed.value);
        }
      }
    }
    
    // Sort messages by timestamp to process in order
    allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Track newly consumed IDs to batch update context
    const newlyConsumed: string[] = [];
    
    // Process each unconsumed message
    for (const message of allMessages) {
      const messageId = message.$jazz?.id;
      if (!messageId || consumedMessageIds.has(messageId)) {
        continue; // Skip already consumed messages
      }
      
      // Mark as consumed BEFORE execution to prevent duplicates
      consumedMessageIds.add(messageId);
      newlyConsumed.push(messageId);
      
      // Call skill directly with actor reference (via centralized registry)
      logger.log('Processing message:', message.type, 'payload:', message.payload);
      const skill = skillRegistry.get(message.type);
      if (skill) {
        // Execute skill and handle async errors
        try {
          const result = skill.execute(actor, message.payload, accountCoState);
          // If it's a promise, handle errors but don't await (fire and forget)
          if (result && typeof result.then === 'function') {
            result.catch((error: any) => {
              logger.error('Skill execution error:', message.type, error);
              // Try to set error on actor context if possible
              if (actor.context && actor.$isLoaded) {
                const updatedContext = { ...(actor.context as Record<string, unknown>) };
                updatedContext.error = error.message || 'Skill execution failed';
                updatedContext.isProcessing = false;
                actor.$jazz.set('context', updatedContext);
              }
            });
          }
        } catch (error: any) {
          logger.error('Skill execution error (sync):', message.type, error);
          // Try to set error on actor context if possible
          if (actor.context && actor.$isLoaded) {
            const updatedContext = { ...(actor.context as Record<string, unknown>) };
            updatedContext.error = error.message || 'Skill execution failed';
            updatedContext.isProcessing = false;
            actor.$jazz.set('context', updatedContext);
          }
        }
      } else {
        logger.warn('No skill found for message type:', message.type);
      }
    }
    
    // Batch update: Persist newly consumed IDs to actor context
    if (newlyConsumed.length > 0 && actor.$isLoaded) {
      const context = actor.context as any;
      const existingConsumed = context?.consumedMessages || [];
      const updatedConsumed = [...existingConsumed, ...newlyConsumed];
      
      // Update actor context with new consumed IDs
      actor.$jazz.set('context', {
        ...context,
        consumedMessages: updatedConsumed,
      });
      
      logger.log(`Marked ${newlyConsumed.length} messages as consumed`);
    }
  });
  
  // ============================================
  // MESSAGE PUBLISHING - PUBLISH TO SUBSCRIBED ACTORS
  // ============================================
  
  function resolvePayload(payload: unknown): unknown {
    if (!payload) return undefined;
    
    const currentContext = actor?.$isLoaded ? resolvedContextWithQueries : null;
    if (!currentContext) return payload;
    
    if (typeof payload === 'string') {
      const resolvedValue = resolveDataPath(currentContext, payload);
      if (payload.endsWith('.id') || payload.match(/\.\w+Id$/)) {
        return { id: resolvedValue };
      }
      return resolvedValue;
    }
    
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      const resolved: Record<string, unknown> = {};
      const DATA_PATH_ROOTS = ['queries.', 'view.', 'item.'];
      
      function isExplicitDataPath(str: string): boolean {
        for (const root of DATA_PATH_ROOTS) {
          if (str.startsWith(root) && str.length > root.length) {
            return true;
          }
        }
        return false;
      }
      
      for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (typeof value === 'string' && isExplicitDataPath(value)) {
          resolved[key] = resolveDataPath(currentContext, value);
        } else {
          resolved[key] = value;
        }
      }
      return resolved;
    }
    
    return payload;
  }
  
  function handleEvent(event: string, payload?: unknown) {
    if (!browser || !actor?.$isLoaded) return;
    
    logger.log(`Sending event: ${event}`, 'raw payload:', payload);
    logger.log('Data structure:', {
      context: Object.keys(resolvedContextWithQueries),
      hasChildActors: !!childActors,
      hasItem: !!item,
      hasAccountCoState: !!accountCoState
    });
    
    const resolvedPayload = resolvePayload(payload);
    logger.log('Resolved payload:', resolvedPayload);
    
    // Create message and append to inbox (CoFeed append-only pattern)
    const message = ActorMessage.create({
      type: event,
      payload: resolvedPayload || {},
      from: actorId,
      timestamp: Date.now(),
    });
    
    // Publish to own inbox (for self-subscribed actors)
    if (actor.inbox?.$isLoaded) {
      actor.inbox.$jazz.push(message);
    }
    
    // Publish to subscribed actors (use pre-loaded CoStates)
    for (const { id: subscriberId, coState } of subscriberCoStates) {
      if (subscriberId === actorId) continue; // Skip self (already published above)
      
      const subscriberActor = coState.current;
      if (subscriberActor?.$isLoaded && subscriberActor.inbox?.$isLoaded) {
        logger.log(`→ Sending to ${subscriberActor.role} (${subscriberId.slice(3, 10)}...)`);
        subscriberActor.inbox.$jazz.push(message);
      }
    }
  }
  
  // ============================================
  // DETERMINE VIEW TYPE FOR RENDERING
  // ============================================
  
  const viewType = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.view) return null;
    const view = actor.view as Record<string, unknown>;
    // Composite has container property
    if (view.container || (view.foreach as any)?.composite) return 'composite';
    // Leaf has tag property
    if (view.tag) return 'leaf';
    return null;
  });
  
  // Load child actors (full CoState objects, not just IDs)
  const childActorCoStates = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.children?.$isLoaded) return [];
    const ids = Array.from(actor.children) as string[];
    return ids.map((id: string) => new CoState(Actor, id));
  });
  
  const childActors = $derived.by(() => {
    return childActorCoStates
      .map((cs: any) => cs.current)
      .filter((a: any) => a?.$isLoaded);
  });

  // Resolve dependencies from IDs to actual CoValue objects (for view bindings)
  const resolvedDependencies = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.dependencies) return {};
    
    const deps: Record<string, any> = {};
    for (const [key, idOrValue] of Object.entries(actor.dependencies)) {
      if (typeof idOrValue === 'string' && idOrValue.startsWith('co_')) {
        // It's a Jazz ID - resolve it to a CoState
        const coState = new CoState(Actor, idOrValue);
        deps[key] = coState.current; // Get the loaded actor object
      } else {
        // Already resolved or not a Jazz ID
        deps[key] = idOrValue;
      }
    }
    return deps;
  });
  
  // Pre-load subscriber CoStates (for event publishing)
  const subscriberCoStates = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.subscriptions?.$isLoaded) return [];
    const ids = Array.from(actor.subscriptions) as string[];
    return ids.map((id: string) => ({
      id,
      coState: new CoState(Actor, id)
    }));
  });
</script>

{#if browser && actor?.$isLoaded && isVisible && viewType}
  {@const view = actor.view as Record<string, unknown>}
  {@const dataForViews = { 
    context: resolvedContextWithQueries, 
    childActors, 
    item, 
    accountCoState,
    dependencies: resolvedDependencies // ✅ Expose RESOLVED dependencies (actual objects, not IDs)
  }}
  {#if viewType === 'composite'}
    <!-- Delegate to Composite.svelte for rendering -->
    <Composite 
      node={{ slot: 'root', composite: view }}
      data={dataForViews}
      onEvent={handleEvent}
    />
  {:else if viewType === 'leaf'}
    <!-- Delegate to Leaf.svelte for rendering -->
    <Leaf 
      node={{ slot: 'root', leaf: view }}
      data={dataForViews}
      onEvent={handleEvent}
    />
  {/if}
{/if}
