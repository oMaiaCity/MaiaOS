<!--
  ActorRenderer Component
  Pure Jazz-native message-passing actor renderer
  NO prop drilling - pure CoState reactivity
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { CoState } from "jazz-tools/svelte";
  import { Actor, ActorMessage } from "@hominio/db";
  import { createDataStore } from "../dataStore";
  import { loadActionsFromRegistry } from "../skillLoader";
  import { registerAllSkills } from "../skills";
  import { resolveDataPath } from "../view/resolver";
  import { useQuery } from "../useQuery.svelte";
  import ActorRendererRecursive from "./ActorRendererRecursive.svelte";
  import Composite from "../view/Composite.svelte";
  import Leaf from "../view/Leaf.svelte";
  
  interface Props {
    actorId: string; // Actor's CoValue ID
    accountCoState?: any; // Global account (for skills)
    itemDependencyId?: string; // For foreach: CoValue ID of item (deprecated)
    item?: any; // For foreach: actual item object
  }
  
  const { actorId, accountCoState, itemDependencyId, item: itemProp }: Props = $props();
  
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
  // JAZZ-NATIVE INBOX SUBSCRIPTION
  // ============================================
  
  // Watch inbox reactively - get latest message from ANY account (not just byMe)
  // Since messages can come from other actors, we need to watch all accounts
  const latestInboxMessage = $derived.by(() => {
    if (!actor?.$isLoaded) return null;
    const inbox = actor.inbox;
    if (!inbox?.$isLoaded) return null;
    
    // Get latest message from current account (byMe)
    const byMeMessage = inbox.byMe?.value;
    if (byMeMessage?.$isLoaded) return byMeMessage;
    
    // If no byMe message, check all accounts for latest message
    // Note: This is a fallback - in practice, byMe should work since all actors share the same account
    // But we check perAccount as a safety net
    if (inbox.perAccount) {
      let latest: any = null;
      let latestTimestamp = 0;
      
      for (const accountId in inbox.perAccount) {
        const accountFeed = inbox.perAccount[accountId];
        if (accountFeed?.value?.$isLoaded) {
          const message = accountFeed.value;
          const timestamp = message.timestamp || 0;
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
            latest = message;
          }
        }
      }
      
      return latest;
    }
    
    return null;
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
  
  // Resolve queries from useQuery results
  const resolvedContext = $derived.by(() => {
    if (!actor?.$isLoaded) return {};
    
    const context = actor.context || {};
    const queries = (context as any).queries;
    
    // If no queries, return context as-is
    if (!queries || typeof queries !== 'object') return context;
    
    // Populate each query's items array from queryResult
    const populatedQueries: Record<string, any> = {};
    for (const [queryKey, queryConfig] of Object.entries(queries)) {
      const config = queryConfig as any;
      if (config?.schemaName) {
        populatedQueries[queryKey] = {
          ...config,
          items: queryResult.entities || [] // Use entities from useQuery
        };
      } else {
        populatedQueries[queryKey] = config;
      }
    }
    
    return {
      ...context,
      queries: populatedQueries
    };
  });
  
  // Create data store from actor's OWN context
  const dataStore = $derived.by(() => {
    if (!actor?.$isLoaded) return null;
    const config = {
      initial: actor.currentState || 'idle',
      states: actor.states || {},
      data: resolvedContext,
    };
    const loadedConfig = loadActionsFromRegistry(config);
    // Pass accountCoState (not accountCoState.current) so skills can access it
    return createDataStore(loadedConfig, accountCoState);
  });
  
  // Track last processed message to avoid duplicates
  let lastProcessedMessageId = $state<string | null>(null);
  
  // Process messages - Jazz CoState auto-triggers this when inbox updates
  $effect(() => {
    if (!latestInboxMessage?.$isLoaded || !browser || !dataStore) return;
    
    // Avoid processing the same message twice
    const messageId = latestInboxMessage.$jazz?.id;
    if (messageId && messageId === lastProcessedMessageId) {
      return;
    }
    
    // Process the message
    console.log('[ActorRenderer] Processing message:', latestInboxMessage.type, latestInboxMessage.payload);
    dataStore.send(latestInboxMessage.type, latestInboxMessage.payload);
    
    // Track this message as processed
    if (messageId) {
      lastProcessedMessageId = messageId;
    }
  });
  
  // Data object for view rendering - includes item for foreach templates
  const data = $derived.by(() => {
    const storeData = dataStore ? $dataStore : {};
    const finalData = item ? { ...storeData, item } : storeData;
    
    // Debug log for list actor
    if (actor?.$isLoaded && actor.role === 'humans-list') {
      const queries = (finalData as any)?.queries;
      console.log('[ActorRenderer] humans-list data:', 
        'hasQueries=', !!queries,
        'humanItemsCount=', queries?.humans?.items?.length || 0);
      if (queries?.humans?.items) {
        console.log('[ActorRenderer] humanItems=', JSON.stringify(queries.humans.items));
      }
    }
    
    return finalData;
  });
  
  // ============================================
  // JAZZ-NATIVE ACTOR LOADING FOR SUBSCRIPTIONS
  // ============================================
  
  // Load subscribed actors - Jazz CoState handles reactivity!
  const subscribedActorCoStates = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.subscriptions?.$isLoaded) return [];
    return Array.from(actor.subscriptions).map((id: string) => new CoState(Actor, id));
  });
  
  const subscribedActors = $derived(
    subscribedActorCoStates
      .map((cs: any) => cs.current)
      .filter((a: any) => a?.$isLoaded)
  );
  
  // ============================================
  // MESSAGE PUBLISHING - JAZZ AUTO-SYNCS
  // ============================================
  
  function resolvePayload(payload: unknown): unknown {
    if (!payload) return undefined;
    
    const currentData = data;
    if (!currentData) return payload;
    
    if (typeof payload === 'string') {
      const resolvedValue = resolveDataPath(currentData, payload);
      if (payload.endsWith('.id') || payload.match(/\.\w+Id$/)) {
        return { id: resolvedValue };
      }
      return resolvedValue;
    }
    
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      const resolved: Record<string, unknown> = {};
      const DATA_PATH_ROOTS = ['data.', 'item.', 'queries.', 'view.'];
      
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
          resolved[key] = resolveDataPath(currentData, value);
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
    
    const resolvedPayload = resolvePayload(payload);
    console.log(`[ActorRenderer] ${actor.role} sending event: ${event}, payload:`, resolvedPayload);
    console.log(`[ActorRenderer] → Subscriptions:`, {
      raw: actor.subscriptions?.$isLoaded ? Array.from(actor.subscriptions) : [],
      subscribedActorRoles: subscribedActors.map((a: any) => a.$isLoaded ? a.role : 'not-loaded'),
      subscribedActorIds: subscribedActors.map((a: any) => a.$jazz?.id),
      thisActorId: actorId,
    });
    
    // Publish to subscribed actors - Jazz syncs automatically!
    for (const targetActor of subscribedActors) {
      if (targetActor?.$isLoaded && targetActor.inbox) {
        console.log(`[ActorRenderer] → Sending to ${targetActor.role} (${targetActor.$jazz?.id})`);
        targetActor.inbox.$jazz.push(
          ActorMessage.create({
            type: event,
            payload: resolvedPayload || {},
            from: actorId,
            timestamp: Date.now(),
          })
        );
        // Jazz syncs this to all subscribers - no manual work!
      }
    }
  }
  
  // ============================================
  // ID-BASED CHILD LOADING
  // ============================================
  
  // Load child actors by ID from actor.children CoList
  const childActorCoStates = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.children?.$isLoaded) return [];
    return Array.from(actor.children).map((id: string) => new CoState(Actor, id));
  });
  
  const childActors = $derived(
    childActorCoStates
      .map((cs: any) => cs.current)
      .filter((a: any) => a?.$isLoaded)
  );
  
  
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
</script>

{#if browser && actor?.$isLoaded && viewType}
  {@const view = actor.view as Record<string, unknown>}
  {#if viewType === 'composite'}
    <!-- Delegate to Composite.svelte for rendering -->
    <Composite 
      node={{ slot: 'root', composite: view }}
      data={{ ...data, childActors, accountCoState }}
      onEvent={handleEvent}
    />
  {:else if viewType === 'leaf'}
    <!-- Delegate to Leaf.svelte for rendering -->
    <Leaf 
      node={{ slot: 'root', leaf: view }}
      data={data || {}}
      onEvent={handleEvent}
    />
  {/if}
{/if}
