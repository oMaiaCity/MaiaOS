# Google Live API Configuration Guide

## What Must Be Configured at Call Start

These settings are set when creating the session with `ai.live.connect()` and **cannot be changed** during the call:

### 1. **Model** (`model`)
- **Required**: Yes
- **Example**: `'gemini-2.5-flash-native-audio-preview-09-2025'`
- **Cannot change**: Model cannot be switched mid-call
- **Current**: Set in `createVoiceSessionManager()`

### 2. **Response Modalities** (`responseModalities`)
- **Required**: Yes
- **Example**: `[Modality.AUDIO]`
- **Cannot change**: Audio/text output modes are fixed at session start
- **Current**: Set to `[Modality.AUDIO]` for voice-only

### 3. **Speech Config** (`speechConfig`)
- **Required**: Yes (for audio responses)
- **Example**: 
  ```typescript
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: 'Sadachbia'
      }
    }
  }
  ```
- **Cannot change**: Voice selection is fixed at session start
- **Current**: Set to `'Sadachbia'` voice

### 4. **Initial System Instruction** (`systemInstruction`)
- **Required**: Yes (but can be updated dynamically)
- **Example**: `{ parts: [{ text: "You are a helpful assistant..." }] }`
- **Can change**: ✅ **YES** - Can be updated via `sendSetup()` during call
- **Current**: Built from `callConfig.json` at session start

### 5. **Initial Tools** (`tools`)
- **Required**: Yes (but can be updated dynamically)
- **Example**: Array of tool schemas
- **Can change**: ✅ **YES** - Can be updated via `sendSetup()` during call
- **Current**: `queryTodos` and `createTodo` tools registered at start

## What Can Be Adjusted Dynamically During Call

According to the Google GenAI SDK documentation, configuration can be updated by sending a `setup` message as part of `LiveClientMessage`. However, **this needs to be verified** as the exact API may vary.

### 1. **System Instruction** ✅ (Likely Supported)
- **Method**: Send `LiveClientMessage` with `setup: { systemInstruction: { parts: [{ text: "..." }] } }`
- **Use case**: Update AI behavior, add context, change instructions
- **Current**: Not implemented - only set at start
- **Note**: Needs verification - check if session has `sendSetup()` or if sent via message

### 2. **Tools** ✅ (Likely Supported)
- **Method**: Send `LiveClientMessage` with `setup: { tools: [...] }`
- **Use case**: Add/remove tools dynamically, update tool schemas
- **Current**: Not implemented - only set at start
- **Note**: Needs verification

### 3. **Generation Config** ✅ (Likely Supported)
- **Method**: Send `LiveClientMessage` with `setup: { generationConfig: { temperature: 0.7, ... } }`
- **Use case**: Adjust temperature, topK, topP, maxOutputTokens
- **Current**: Not implemented
- **Note**: Needs verification

### 4. **Context Window Compression** ✅ (Likely Supported)
- **Method**: Send `LiveClientMessage` with `setup: { contextWindowCompression: {...} }`
- **Use case**: Adjust compression settings
- **Current**: Not implemented
- **Note**: Needs verification

### 5. **Proactivity Config** ✅ (Likely Supported)
- **Method**: Send `LiveClientMessage` with `setup: { proactivity: {...} }`
- **Use case**: Control when AI proactively speaks
- **Current**: Not implemented
- **Note**: Needs verification

### 6. **Realtime Input Config** ✅ (Likely Supported)
- **Method**: Send `LiveClientMessage` with `setup: { realtimeInputConfig: {...} }`
- **Use case**: Adjust real-time input handling
- **Current**: Not implemented
- **Note**: Needs verification

## What Can Be Sent Dynamically (Content, Not Config)

These are sent as messages, not configuration:

### 1. **Client Content** ✅ (Currently Used)
- **Method**: `session.sendClientContent({ turns: "...", turnComplete: true/false })`
- **Use case**: Send text context, updates, user messages
- **Current**: Used in `ContextIngestService.ingest()`

### 2. **Tool Responses** ✅ (Currently Used)
- **Method**: `session.sendToolResponse({ functionResponses: [...] })`
- **Use case**: Send tool execution results back to AI
- **Current**: Used in `ContextIngestService.ingestToolResponse()`

### 3. **Realtime Input** ✅
- **Method**: `session.sendRealtimeInput({ media: {...} })`
- **Use case**: Send audio/text input in real-time
- **Current**: Used in `session.sendAudio()`

## Current Implementation Summary

### ✅ Configured at Start (Fixed)
- Model: `gemini-2.5-flash-native-audio-preview-09-2025`
- Response Modalities: `[Modality.AUDIO]`
- Speech Config: Voice `'Sadachbia'`
- Initial System Instruction: From `callConfig.json`
- Initial Tools: `queryTodos`, `createTodo`

### ✅ Dynamic During Call (Currently Used)
- Client Content: Via `sendClientContent()` - context updates
- Tool Responses: Via `sendToolResponse()` - tool results
- Realtime Input: Via `sendRealtimeInput()` - audio/text

### ❌ Dynamic During Call (Not Currently Implemented)
- System Instruction Updates: Could update via `sendSetup()`
- Tool Updates: Could add/remove tools via `sendSetup()`
- Generation Config: Could adjust temperature/etc via `sendSetup()`

## Recommendations

### For Your Use Case

**Keep Fixed at Start:**
- Model (makes sense - switching models mid-call would be disruptive)
- Response Modalities (audio-only is fine)
- Speech Config (voice selection is fine)

**Consider Making Dynamic:**
1. **System Instruction**: If you want to add context or change behavior mid-call
   - Example: Add calendar context when user asks about schedule
   - Implementation: Add `updateSystemInstruction()` method

2. **Tools**: If you want to enable/disable tools dynamically
   - Example: Load tools based on user needs
   - Implementation: Add `updateTools()` method

3. **Generation Config**: If you want to adjust AI behavior
   - Example: Increase temperature for creative tasks
   - Implementation: Add `updateGenerationConfig()` method

### Implementation Pattern

To add dynamic configuration updates, you would add methods like:

```typescript
// In VoiceSessionManager interface
updateSystemInstruction(instruction: string): void;
updateTools(tools: any[]): void;
updateGenerationConfig(config: GenerationConfig): void;

// Implementation
updateSystemInstruction(instruction: string) {
  this.session.sendSetup({
    systemInstruction: {
      parts: [{ text: instruction }]
    }
  });
}
```

## Key Takeaways

1. **Fixed at Start**: Model, response modalities, speech config (voice)
2. **Dynamic via `sendSetup()`**: System instruction, tools, generation config
3. **Dynamic via Messages**: Client content, tool responses, realtime input
4. **Current Gap**: Not using `sendSetup()` for dynamic config updates - everything is set at start

