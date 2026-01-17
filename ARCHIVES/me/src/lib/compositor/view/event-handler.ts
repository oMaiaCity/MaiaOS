/**
 * Event Handler Module
 * Creates DOM event listeners from Event Configs
 * Part of Phase 3: Modular Architecture
 */

import { resolveDataPath } from './resolver'

/**
 * Resolve event payload (data paths → values)
 */
export function resolvePayload(
  payload: Record<string, unknown> | string | ((data: unknown) => unknown) | undefined,
  data: Record<string, any>
): unknown {
  if (!payload) return undefined
  
  // String data path
  if (typeof payload === 'string') {
    const value = resolveDataPath(data, payload)
    // Wrap ID paths as { id: value }
    if (payload.endsWith('.id') || payload === 'item.id' || payload === 'data.item.id') {
      return { id: value }
    }
    return value
  }
  
  // Function payload
  if (typeof payload === 'function') {
    return payload(data)
  }
  
  // Object payload (resolve nested paths)
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const resolved: Record<string, unknown> = {}
    const DATA_PATH_ROOTS = ['data.', 'item.', 'context.', 'queries.', 'view.', 'dependencies.']
    
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') {
        // Check if it's a data path
        const isDataPath = DATA_PATH_ROOTS.some(
          root => value.startsWith(root) && value.length > root.length
        )
        resolved[key] = isDataPath ? resolveDataPath(data, value) : value
      } else {
        resolved[key] = value
      }
    }
    return resolved
  }
  
  return payload
}

/**
 * Create standard event handler function
 */
export function createEventHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): () => void {
  return () => {
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create click event handler
 */
export function createClickHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: MouseEvent) => void {
  return (e: MouseEvent) => {
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create submit event handler (prevents default)
 */
export function createSubmitHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: Event) => void {
  return (e: Event) => {
    e.preventDefault()
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create input event handler (extracts value from event)
 */
export function createInputHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void,
  fieldName: string = 'text'
): (e: Event) => void {
  return (e: Event) => {
    const target = e.target as HTMLInputElement
    const inputValue = target.value
    
    // Merge input value with payload
    const basePayload = resolvePayload(eventConfig.payload, data)
    const payload = typeof basePayload === 'object' && basePayload !== null && !Array.isArray(basePayload)
      ? { ...basePayload, [fieldName]: inputValue }
      : { [fieldName]: inputValue }
    
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create drag start handler (stores ID in dataTransfer)
 */
export function createDragStartHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    if (!e.dataTransfer) return
    
    e.dataTransfer.effectAllowed = 'move'
    
    // Resolve payload
    const payload = resolvePayload(eventConfig.payload, data)
    
    // Store ID in dataTransfer
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const payloadObj = payload as Record<string, unknown>
      if ('id' in payloadObj) {
        e.dataTransfer.setData('text/plain', String(payloadObj.id))
      }
    } else if (typeof payload === 'string') {
      e.dataTransfer.setData('text/plain', payload)
    }
    
    // Notify actor (optional)
    if (eventConfig.event) {
      onEvent(eventConfig.event, payload)
    }
  }
}

/**
 * Create drop handler (merges draggedId with payload)
 */
export function createDropHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Get dragged ID from dataTransfer
    const draggedId = e.dataTransfer?.getData('text/plain')
    const dropPayload = resolvePayload(eventConfig.payload, data)
    
    // Merge draggedId with drop payload
    if (draggedId && dropPayload && typeof dropPayload === 'object' && !Array.isArray(dropPayload)) {
      onEvent(eventConfig.event, { id: draggedId, ...dropPayload })
    } else if (draggedId) {
      onEvent(eventConfig.event, { id: draggedId })
    } else {
      onEvent(eventConfig.event, dropPayload)
    }
  }
}

/**
 * Create drag over handler (allows drop)
 */
export function createDragOverHandler(): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }
}

/**
 * Create drag enter handler (visual feedback)
 */
export function createDragEnterHandler(
  eventConfig: { event: string; payload?: any } | undefined,
  data: Record<string, any>,
  onEvent: ((event: string, payload?: unknown) => void) | undefined,
  setDragOver: (value: boolean) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    setDragOver(true)
    if (eventConfig && onEvent) {
      const payload = resolvePayload(eventConfig.payload, data)
      onEvent(eventConfig.event, payload)
    }
  }
}

/**
 * Create drag leave handler (remove visual feedback)
 */
export function createDragLeaveHandler(
  eventConfig: { event: string; payload?: any } | undefined,
  data: Record<string, any>,
  onEvent: ((event: string, payload?: unknown) => void) | undefined,
  setDragOver: (value: boolean) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    // Only remove drag-over state if actually leaving
    const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect()
    if (rect && (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    )) {
      setDragOver(false)
    }
    if (eventConfig && onEvent) {
      const payload = resolvePayload(eventConfig.payload, data)
      onEvent(eventConfig.event, payload)
    }
  }
}

/**
 * Create drag end handler
 */
export function createDragEndHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): () => void {
  return () => {
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}
