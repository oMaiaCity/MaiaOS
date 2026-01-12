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
    if (!context || typeof context !== 'object') return {};
    
    const queries = context?.queries;
    // CRITICAL: Return new object to ensure Svelte detects changes
    if (!queries || typeof queries !== 'object') return { ...context };
    
    // Access accountCoState reactively to establish reactivity chain
    if (!accountCoState) return { ...context };
    const account = accountCoState.current;
    if (!account?.$isLoaded) return { ...context };
    
    const root = account.root;
    if (!root?.$isLoaded) return { ...context };
    
    const entitiesList = root.entities;
    if (!entitiesList?.$isLoaded) return { ...context };
    
    const schemata = root.schemata;
    if (!schemata?.$isLoaded) return { ...context };
    
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
  // MESSAGE CONSUMPTION TRACKING - WATERMARK PATTERN
  // ============================================
  // WATERMARK PATTERN: Use timestamp-based high-water mark
  // CoFeeds are append-only - messages are sorted by timestamp
  // Track highest timestamp processed to avoid replay (O(1) instead of O(n))
  
  // Get watermark from actor (timestamp of last processed message)
  // System property: tracks highest timestamp processed
  const inboxWatermark = $derived.by(() => {
    if (!actor?.$isLoaded) return 0;
    return actor.inboxWatermark || 0;
  });
  
  // Processing guard to prevent infinite loops from $effect re-runs
  let isProcessing = $state(false);
  
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
    
    // Debug: Log inbox structure
    logger.log('[ActorEngine] Inbox structure:', {
      hasInbox: !!inbox,
      hasByMe: !!inbox.byMe,
      byMeHasAll: !!inbox.byMe?.all,
      byMeHasValue: !!inbox.byMe?.value,
      byMeKeys: inbox.byMe ? Object.keys(inbox.byMe) : [],
      hasPerAccount: !!inbox.perAccount,
      perAccountKeys: inbox.perAccount ? Object.keys(inbox.perAccount) : [],
    });
    
    // CoFeed pattern: inbox.byMe is the account feed with .all property
    // Iterate through ALL entries from the current account (all sessions)
    if (inbox.byMe?.all) {
      logger.log('[ActorEngine] Iterating byMe.all');
      for (const entry of inbox.byMe.all) {
        if (entry.value?.$isLoaded) {
          const messageId = entry.value.$jazz?.id;
          if (messageId) {
            messagesMap.set(messageId, entry.value);
          }
        }
      }
    } else if (inbox.byMe?.value?.$isLoaded) {
      // Fallback: use .value if .all doesn't exist
      logger.log('[ActorEngine] Fallback to byMe.value');
      const messageId = inbox.byMe.value.$jazz?.id;
      if (messageId) {
        messagesMap.set(messageId, inbox.byMe.value);
      }
    }
    
    // Same for perAccount - iterate ALL entries from each account
    if (inbox.perAccount) {
      for (const accountId in inbox.perAccount) {
        const accountFeed = inbox.perAccount[accountId];
        
        // Try .all first (all entries from this account)
        if (accountFeed?.all) {
          for (const entry of accountFeed.all) {
            if (entry.value?.$isLoaded) {
              const messageId = entry.value.$jazz?.id;
              if (messageId && !messagesMap.has(messageId)) {
                messagesMap.set(messageId, entry.value);
              }
            }
          }
        } else if (accountFeed?.value?.$isLoaded) {
          // Fallback: use .value if .all doesn't exist
          const messageId = accountFeed.value.$jazz?.id;
          if (messageId && !messagesMap.has(messageId)) {
            messagesMap.set(messageId, accountFeed.value);
          }
        }
      }
    }
    
    logger.log(`[ActorEngine] Found ${messagesMap.size} total messages in inbox`);
    
    // Convert to array and sort by timestamp
    const allMessages = Array.from(messagesMap.values());
    allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Filter to only NEW messages (after watermark)
    const newMessages = allMessages.filter(
      msg => (msg.timestamp || 0) > inboxWatermark
    );
    
    // Skip if no new messages
    if (newMessages.length === 0) return;
    
    // Set processing flag to prevent re-entrance
    isProcessing = true;
    
    // Process each new message SEQUENTIALLY (await each one)
    // This prevents race conditions where tool execution happens out of order
    (async () => {
      try {
        for (const message of newMessages) {
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
        
        // Update watermark: Persist highest processed timestamp
        // System property: stored at actor root, not in context
        if (newMessages.length > 0 && actor.$isLoaded) {
          const latestTimestamp = newMessages[newMessages.length - 1].timestamp;
          
          // Update actor's watermark (system property)
          actor.$jazz.set('inboxWatermark', latestTimestamp);
          
          logger.log(`Updated watermark to ${latestTimestamp} (processed ${newMessages.length} messages)`);
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
  // CRITICAL: Access .current to establish reactive subscription
  const resolvedDependencies = $derived.by(() => {
    const deps: Record<string, any> = {};
    for (const [key, coStateOrValue] of dependencyCoStates.entries()) {
      if (coStateOrValue?.current !== undefined) {
        // It's a CoState - access .current reactively
        const current = coStateOrValue.current;
        deps[key] = current;
      } else {
        // Not a CoState - use directly
        deps[key] = coStateOrValue;
      }
    }
    return deps;
  });
  
  // Data object for ViewEngine - must be derived to ensure reactivity
  const dataForViews = $derived.by(() => {
    return {
      context: resolvedContextWithQueries,
      childActors,
      item,
      accountCoState,
      dependencies: resolvedDependencies // ✅ Reactively expose dependencies
    };
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
