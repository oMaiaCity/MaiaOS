# Voice Turn Logic in Google Live API

## Understanding "Turn Complete" vs "Turn Open"

### Turn Complete (`turnComplete: true`)
- **What it means**: The user's turn is finished, and the AI should process and respond
- **When to use**: After the user finishes speaking or when you want the AI to respond
- **Effect**: Triggers the AI to process the input and generate a voice response

### Turn Open (`turnComplete: false`)
- **What it means**: The user's turn is still ongoing (more content coming)
- **When to use**: When streaming content or adding context without triggering a response
- **Effect**: AI waits for more input before responding

## Current Implementation

### Context Injection Service (`libs/hominio-voice/src/server/context-injection.ts`)

```typescript
// Standard context injection
injectContext(content: string, turnComplete: boolean = true)

// Vibe context injection (always turnComplete: true)
injectVibeContext(vibeId: string, contextString: string)
```

**Key Points:**
- `queryVibeContext` uses `turnComplete: true` but is a **background operation**
- The AI won't respond because it's just loading context, not a user query
- Other context injections default to `turnComplete: true`

### How It Works

1. **User speaks** → Audio sent → `turnComplete: true` → AI responds
2. **Context injection** → Text sent → `turnComplete: true` → AI processes but may respond
3. **Background context** (queryVibeContext) → Text sent → `turnComplete: false` → Keeps conversation open, no AI response

## Problem: Preventing Voice Responses on Context Updates

Currently, when you add context (like calendar updates), it uses `turnComplete: true`, which can trigger the AI to respond verbally.

### Solution: Use `turnComplete: false` for Silent Context Updates

When updating context without wanting a voice response:

1. **Use `turnComplete: false`** - This tells the AI "more content is coming, don't respond yet"
2. **Send context as system/background information** - Format it as informational context, not a query

## Implementation

### Option 1: Add Silent Context Injection Method

```typescript
// In ContextInjectionService
async injectSilentContext(content: string, contextLabel?: string): Promise<boolean> {
    // Use turnComplete: false to prevent AI response
    return this.injectContext(content, false, contextLabel);
}
```

### Option 2: Update Existing Method with Parameter

```typescript
// Allow explicit control
async injectContext(
    content: string,
    turnComplete: boolean = true,  // Default to true for backward compatibility
    contextLabel?: string
): Promise<boolean>
```

### Current Usage Locations

1. **NavPill** (`services/app/src/lib/components/NavPill.svelte`):
   ```typescript
   voiceCall.sendTextMessage(`[System] Updated context: ${text}`);
   ```
   - Currently uses `turnComplete: true` (default)
   - **Should use `turnComplete: false`** to prevent voice response

2. **Query Vibe Context** (`libs/hominio-voice/src/server/tools/query-vibe-context.ts`):
   ```typescript
   injectFn({
       turns: contextString,
       turnComplete: false  // Keep conversation loop open
   });
   ```
   - Uses `turnComplete: false` to keep conversation open without triggering AI response
   - Context is loaded silently and available for next user query

3. **Action Skill Results** (`services/app/src/routes/me/+page.svelte`):
   ```typescript
   // Sends context updates after skill execution
   window.dispatchEvent(updateEvent);
   ```
   - Should use `turnComplete: false` to prevent voice response

## Best Practices

1. **User queries**: Always use `turnComplete: true`
2. **Background context loading** (queryVibeContext): Use `turnComplete: false` to keep conversation open
3. **Context updates during conversation**: Use `turnComplete: false` to prevent interruption
4. **System messages**: Use `turnComplete: false` unless you want AI to acknowledge

## Example: Silent Context Update

```typescript
// Update calendar context without triggering voice response
const contextText = "Updated calendar: Meeting at 2pm tomorrow";
contextInjection.injectContext(contextText, false, "calendar update");
```

This will:
- ✅ Add the context to the conversation
- ✅ Not trigger a voice response
- ✅ Be available for future queries

