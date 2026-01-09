<script lang="ts">
  import type { CoValueContext } from "@maia/db";
  import type { LocalNode } from "cojson";
  import ListItem from "./ListItem.svelte";

  interface Props {
    properties: Record<string, any>;
    node?: LocalNode;
    directChildren?: CoValueContext["directChildren"]; // Optional direct children for type resolution
    onNavigate?: (coValueId: string, label?: string) => void;
    onObjectNavigate?: (
      object: any,
      label: string,
      parentCoValue: any,
      parentKey: string,
    ) => void;
    parentCoValue?: any; // Parent CoValue/snapshot for object navigation
    schemaDefinition?: any; // Schema definition JSON Schema object (passed from Context)
  }

  const {
    properties,
    node,
    directChildren,
    onNavigate,
    onObjectNavigate,
    parentCoValue,
    schemaDefinition: schemaDefinitionProp,
  }: Props = $props();

  // Show all properties except system properties starting with "@" (shown in metadata sidebar)
  const entries = $derived(
    Object.entries(properties).filter(([key]) => !key.startsWith('@')),
  );

  // Use schema definition from prop if provided, otherwise compute from parentCoValue
  const schemaDefinition = $derived(() => {
    // If schema definition is passed as prop, unwrap it if it's a function
    let propValue: any = schemaDefinitionProp;
    
    // If prop is a function (from $derived), unwrap it
    if (typeof propValue === 'function') {
      try {
        propValue = propValue();
      } catch (_e) {
        propValue = null;
      }
    }
    
    // If we got a valid object with properties, use it
    if (propValue && typeof propValue === 'object' && propValue.properties && typeof propValue.properties === 'object') {
      return propValue;
    }
    
    // Otherwise, compute from parentCoValue's @schema field using reactive Jazz resolution
    if (!parentCoValue || typeof parentCoValue !== 'object') return null;
    
    const schemaRef = parentCoValue['@schema'];
    if (!schemaRef) return null;
    
    // Find schema in directChildren
    const schemaId = typeof schemaRef === 'string' && schemaRef.startsWith('co_')
      ? schemaRef
      : (schemaRef && typeof schemaRef === 'object' && '$jazz' in schemaRef)
        ? schemaRef.$jazz?.id
        : null;
    
    if (!schemaId) return null;
    
    const schemaChild = directChildren?.find((c) => c.coValueId === schemaId);
    if (!schemaChild) return null;
    
    // Use reactive Jazz resolution: access CoValue directly instead of snapshot
    const schemaCoValue = schemaChild?.resolved?.value;
    if (schemaCoValue && typeof schemaCoValue === 'object') {
      try {
        const definition = (schemaCoValue as any).definition;
        if (definition && typeof definition === 'object' && definition.properties && typeof definition.properties === 'object') {
          return definition;
        }
      } catch (_e) {
        // If direct access fails, fall through to snapshot access
      }
    }
    
    // Fallback: try snapshot access
    const schemaSnapshot = schemaChild?.resolved?.snapshot;
    if (schemaSnapshot && typeof schemaSnapshot === 'object' && 'definition' in schemaSnapshot) {
      const definition = schemaSnapshot.definition;
      if (definition && typeof definition === 'object' && definition.properties && typeof definition.properties === 'object') {
        return definition;
      }
    }
    
    return null;
  });
</script>

<div class="space-y-3">
  {#each entries as [key, value]}
    {@const child = directChildren?.find((c) => c.key === key)}
    <ListItem
      propKey={key}
      propValue={value}
      {node}
      resolvedType={child?.resolved}
      {onNavigate}
      {onObjectNavigate}
      {parentCoValue}
      schemaDefinition={schemaDefinition}
    />
  {/each}
</div>
