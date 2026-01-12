<!--
  ActorEngine Component
  JAZZ-NATIVE ARCHITECTURE - Pure CoState reactivity
  Engine Pattern: Actor JSON → Rendered DOM + State
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { CoState } from "jazz-tools/svelte";
  import { Actor, ActorMessage } from "@maia/db";
  import { registerAllTools, ToolEngine } from "../tools";
  import { resolveDataPath } from "../view/resolver";
  import { safeEvaluate } from '@maia/script';
  import type { EvaluationContext } from '@maia/script';
  import type { QueryConfig } from '../tools/types';
  import ViewEngine from "./ViewEngine.svelte";
  import { createActorLogger } from "$lib/utils/logger";

  
  interface Props {
    actorId: string; // Actor's CoValue ID
    accountCoState?: any; // Global account (for skills)
    item?: any; // For foreach: actual item object
  }
  
  const { actorId, accountCoState, item: itemProp }: Props = $props();
  
  // Create actor-specific logger (will be initialized once actor loads)
  let logger = $derived.by(() => createActorLogger(actor));
  
  // Register tools once
  if (browser) registerAllTools();
  
  // ============================================
  // JAZZ-NATIVE REACTIVE ACTOR LOADING
  // ============================================
  
  // Load actor - Jazz CoState handles reactivity
  // Use $state and $effect to avoid creating effects inside $derived
  let actorCoState = $state<CoState<typeof Actor>>(new CoState(Actor, actorId));
  
  // Update CoState when actorId changes
  $effect(() => {
    actorCoState = new CoState(Actor, actorId);
  });
  
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
  
  // Get queries from actor's context and execute each one
  // Supports multiple queries per actor using MaiaScript operations
  // IMPORTANT: Inline query execution to preserve CoState reactivity
  const resolvedContextWithQueries = $derived.by(() => {
    if (!actor?.$isLoaded) return {};
    
    const context = (actor as any).context;
    if (!context || typeof context !== 'object') return context;
    
    const queries = context?.queries;
    if (!queries || typeof queries !== 'object') return context;
    
    // Access accountCoState reactively to establish reactivity chain
    if (!accountCoState) return context;
    const account = accountCoState.current;
    if (!account?.$isLoaded) return context;
    
    const root = account.root;
    if (!root?.$isLoaded) return context;
    
    const entitiesList = root.entities;
    if (!entitiesList?.$isLoaded) return context;
    
    const schemata = root.schemata;
    if (!schemata?.$isLoaded) return context;
    
    // Create a new context object with populated query results
    // This doesn't mutate the Jazz context, just creates a derived view
    const resolvedQueries: Record<string, any> = {};
    
    // Execute each query inline (preserves reactivity)
    for (const [queryKey, queryConfig] of Object.entries(queries)) {
      const config = queryConfig as any;
      
      if (!config?.schemaName) {
        // Invalid query config - keep as-is
        resolvedQueries[queryKey] = config;
        continue;
      }
      
      // Find target schema ID by name (reactive access)
      let targetSchemaId: string | null = null;
      for (const schema of schemata) {
        if (!schema?.$isLoaded) continue;
        const schemaSnapshot = schema.$jazz?.raw?.toJSON();
        if (schemaSnapshot?.type === 'Relation') continue;
        if (schemaSnapshot?.name === config.schemaName) {
          targetSchemaId = schema.$jazz?.id;
          break;
        }
      }
      
      if (!targetSchemaId) {
        resolvedQueries[queryKey] = { ...config, items: [] };
        continue;
      }
      
      // Filter entities by schema ID and convert to plain objects
      const results: Array<Record<string, unknown>> = [];
      for (const entity of entitiesList) {
        if (!entity?.$isLoaded) continue;
        const snapshot = entity.$jazz?.raw?.toJSON();
        const entitySchemaId = snapshot?.['@schema'];
        if (entitySchemaId === targetSchemaId) {
          // Convert to plain object (inline coValueToPlainObject logic)
          const id = entity.$jazz?.id || '';
          const result: Record<string, unknown> = { id, _coValueId: id };
          const jsonSnapshot = entity.$jazz?.raw?.toJSON?.() || entity.toJSON?.();
          if (jsonSnapshot && typeof jsonSnapshot === 'object') {
            for (const key in jsonSnapshot) {
              if (key !== 'id' && key !== '_coValueId' && !key.startsWith('_') && key !== '$jazz') {
                result[key] = jsonSnapshot[key];
              }
            }
          }
          results.push(result);
        }
      }
      
      // Apply MaiaScript operations if provided
      let finalResults = results;
      if (config.operations) {
        const evalCtx: EvaluationContext = { context: {}, dependencies: {}, item: {} };
        const operations = config.operations as any;
        
        // Check if operations is a $pipe expression
        if (operations.$pipe && Array.isArray(operations.$pipe)) {
          // $pipe expects: [operationsArray, entities]
          const result = safeEvaluate(
            { $pipe: [operations.$pipe, results] } as any,
            evalCtx
          );
          finalResults = Array.isArray(result) ? result : results;
        } else {
          // Check if operations is a single operation object
          const opKeys = Object.keys(operations);
          if (opKeys.length === 1 && opKeys[0].startsWith('$')) {
            const opKey = opKeys[0];
            const opConfig = operations[opKey];
            
            // Query operations expect: [config, entities]
            // Now properly validated and evaluated through MaiaScript DSL
            const result = safeEvaluate(
              { [opKey]: [opConfig, results] } as any,
              evalCtx
            );
            finalResults = Array.isArray(result) ? result : results;
          }
        }
      }
      
      // Populate query result with items
      resolvedQueries[queryKey] = {
        ...config,
        items: finalResults,
      };
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
  
  // Processing guard to prevent infinite loops from $effect re-runs
  let isProcessing = $state(false);
  
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
    if (isProcessing) return; // Prevent re-entrance while processing
    
    const inbox = actor.inbox;
    if (!inbox?.$isLoaded) return;
    
    // Collect ALL messages from the inbox (byMe and perAccount)
    // Use Map to dedup by message ID (same message may appear in multiple feeds)
    const messagesMap = new Map<string, any>();
    
    // Get byMe messages
    const byMeMessage = inbox.byMe?.value;
    if (byMeMessage?.$isLoaded) {
      const messageId = byMeMessage.$jazz?.id;
      if (messageId) {
        messagesMap.set(messageId, byMeMessage);
      }
    }
    
    // Get perAccount messages
    if (inbox.perAccount) {
      for (const accountId in inbox.perAccount) {
        const accountFeed = inbox.perAccount[accountId];
        if (accountFeed?.value?.$isLoaded) {
          const messageId = accountFeed.value.$jazz?.id;
          if (messageId && !messagesMap.has(messageId)) {
            messagesMap.set(messageId, accountFeed.value);
          }
        }
      }
    }
    
    // Convert to array and sort by timestamp
    const allMessages = Array.from(messagesMap.values());
    allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Filter to only NEW unconsumed messages
    const unconsumedMessages = allMessages.filter((message) => {
      const messageId = message.$jazz?.id;
      return messageId && !consumedMessageIds.has(messageId);
    });
    
    // Skip if no new messages
    if (unconsumedMessages.length === 0) return;
    
    // Track newly consumed IDs to batch update context
    const newlyConsumed: string[] = [];
    
    // Set processing flag to prevent re-entrance
    isProcessing = true;
    
    // Process each unconsumed message SEQUENTIALLY (await each one)
    // This prevents race conditions where tool execution happens out of order
    (async () => {
      try {
        for (const message of unconsumedMessages) {
          const messageId = message.$jazz?.id;
          if (!messageId) continue;
          
          // Mark as consumed BEFORE execution to prevent duplicates
          consumedMessageIds.add(messageId);
          newlyConsumed.push(messageId);
          
          // Execute tool via ToolEngine (unified pattern)
          logger.log('Processing message:', message.type, 'payload:', message.payload);
          try {
            // AWAIT tool execution to ensure sequential processing
            // This prevents context updates from happening out of order
            await ToolEngine.execute(message.type, actor, message.payload, accountCoState);
          } catch (error: any) {
            logger.error('Tool execution error:', message.type, error);
            // Try to set error on actor context if possible
            if (actor.context && actor.$isLoaded) {
              const updatedContext = { ...(actor.context as Record<string, unknown>) };
              updatedContext.error = error.message || 'Tool execution failed';
              updatedContext.isProcessing = false;
              actor.$jazz.set('context', updatedContext);
            }
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
      } finally {
        // Always clear processing flag, even if there was an error
        isProcessing = false;
      }
    })();
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
  // Use $state and $effect to avoid creating effects inside $derived
  let childActorCoStates = $state<Array<CoState<typeof Actor>>>([]);
  
  $effect(() => {
    if (!actor?.$isLoaded || !actor.children?.$isLoaded) {
      childActorCoStates = [];
      return;
    }
    const ids = Array.from(actor.children) as string[];
    childActorCoStates = ids.map((id: string) => new CoState(Actor, id));
  });
  
  const childActors = $derived.by(() => {
    return childActorCoStates
      .map((cs: any) => cs.current)
      .filter((a: any) => a?.$isLoaded);
  });

  // Store CoState instances for dependencies (for reactive access)
  // Use $state and $effect to avoid creating effects inside $derived
  let dependencyCoStates = $state<Map<string, any>>(new Map());
  
  $effect(() => {
    if (!actor?.$isLoaded || !actor.dependencies) {
      dependencyCoStates = new Map();
      return;
    }
    
    const coStates = new Map<string, any>();
    for (const [key, idOrValue] of Object.entries(actor.dependencies)) {
      if (typeof idOrValue === 'string' && idOrValue.startsWith('co_')) {
        // Store CoState instance (not .current) for reactive access
        coStates.set(key, new CoState(Actor, idOrValue));
      } else {
        // Already resolved or not a Jazz ID - store directly
        coStates.set(key, idOrValue);
      }
    }
    dependencyCoStates = coStates;
  });

  // Resolve dependencies from IDs to actual CoValue objects (for view bindings)
  // CRITICAL: Access .current here to make it reactive
  const resolvedDependencies = $derived.by(() => {
    const deps: Record<string, any> = {};
    for (const [key, coStateOrValue] of dependencyCoStates.entries()) {
      if (coStateOrValue?.current !== undefined) {
        // It's a CoState - access .current reactively
        const current = coStateOrValue.current;
        // Access the properties we care about to ensure reactivity
        if (current?.$isLoaded && current.context) {
          const _ = current.context; // Access context for reactivity
          // For contentActor, specifically access viewMode
          if ((current as any).context?.viewMode !== undefined) {
            const __ = (current as any).context.viewMode;
          }
        }
        deps[key] = current;
      } else {
        // Not a CoState - use directly
        deps[key] = coStateOrValue;
      }
    }
    return deps;
  });
  
  // Pre-load subscriber CoStates (for event publishing)
  // Use $state and $effect to avoid creating effects inside $derived
  let subscriberCoStates = $state<Array<{ id: string; coState: CoState<typeof Actor> }>>([]);
  
  $effect(() => {
    if (!actor?.$isLoaded || !actor.subscriptions?.$isLoaded) {
      subscriberCoStates = [];
      return;
    }
    const ids = Array.from(actor.subscriptions) as string[];
    subscriberCoStates = ids.map((id: string) => ({
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
  {@const viewNode = viewType === 'composite' 
    ? { slot: 'root', composite: view } 
    : { slot: 'root', leaf: view }}
  <!-- Delegate to ViewEngine for unified rendering -->
  <ViewEngine 
    node={viewNode}
    data={dataForViews}
    onEvent={handleEvent}
  />
{/if}
