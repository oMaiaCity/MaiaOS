---
name: chat-app-event-flow
overview: Compact, simplified chat agent flows with strict view/service separation. Single source of truth for error. Universal sibling refs.
todos:
  - id: consolidate-error
    content: One error owner (messages). Remove error display from input.
    status: completed
  - id: sibling-refs
    content: messages uses $targetInput for ERROR/DISMISS tells.
    status: completed
  - id: remove-guards
    content: Remove $onlyWhenOriginated (eliminated by consolidation).
    status: completed
  - id: mount-clear
    content: Session-scoped clear on mount for messages only.
    status: completed
isProject: true
---

# Chat App: Compact Flow + View/Service Separation

**Principles**: compact-simplify-consolidate, strict separation (View vs Service), single source of truth, universal sibling refs.

---

## 1. Separation of Concerns (Immutable)

```mermaid
flowchart TB
    subgraph View["VIEW LAYER - UI only"]
        Input["input/for-chat"]
        Messages["views/messages"]
    end

    subgraph Service["SERVICE LAYER - business logic"]
        OSMsg["os/messages"]
        AI["os/ai"]
    end

    Input -->|"tell $targetActor"| Messages
    Messages -->|"tell °Maia/actor/os/messages"| OSMsg
    OSMsg -->|"ask CHAT"| AI

    Note1["View: capture input, display, no LLM"]
    Note2["Service: LLM, chat history, no UI"]
```




| Layer       | Actors             | Owns                                 | Never                      |
| ----------- | ------------------ | ------------------------------------ | -------------------------- |
| **View**    | input, messages    | UI state, display, form              | Call LLM, own chat history |
| **Service** | os/messages, os/ai | conversations, _pendingReplyTo, CHAT | Render UI, own inputValue  |


---

## 2. Consolidated Context (Single Source of Truth)

**Before (duplication)**:

- input: hasError, error, error-message div, Dismiss btn
- messages: hasError, error, error div, Dismiss btn
- Both display. Both clear. Guards. Schema refs.

**After (consolidated)**:


| Actor           | Context                                                           | Responsibility                                                       |
| --------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| **input**       | inputValue, hasError (guard only), targetActor                    | Capture, send. Guard blocks submit when error. **No error display.** |
| **messages**    | phase, isLoading, hasError, error, conversations, **targetInput** | Orchestrate, display chat, **own & display error**, Dismiss          |
| **os/messages** | conversations, _pendingReplyTo                                    | LLM bridge                                                           |


**Elimination**: input's error-message div, input's Dismiss button, input's DISMISS handler, $onlyWhenOriginated guards, 50% of error-related code.

---

## 3. Unified Event Flow (Consolidated)

```mermaid
flowchart LR
    subgraph UserActions["User"]
        A1[Type]
        A2[Submit]
        A3[Dismiss]
    end

    subgraph ViewFlow["View Layer"]
        B1[input: UPDATE_INPUT]
        B2[input: FORM_SUBMIT]
        B3[messages: DISMISS]
    end

    subgraph ServiceFlow["Service Layer"]
        C1[os/messages: SEND_MESSAGE]
        C2[os/ai: CHAT]
        C3[SUCCESS / ERROR]
    end

    A1 --> B1
    A2 --> B2 --> C1 --> C2
    C2 --> C3
    C3 -->|ERROR| B4[messages: ctx + tell input ERROR]
    A3 --> B3
    B3 --> B5[messages: ctx + tell input DISMISS]
```



---

## 4. Happy Path (unchanged, clean)

```mermaid
sequenceDiagram
    participant User
    participant Input as input
    participant Messages as messages
    participant OSMsg as os/messages
    participant AI as os/ai

    User->>Input: FORM_SUBMIT
    Input->>Input: guard hasError=false
    Input->>Messages: tell $targetActor SEND_MESSAGE
    Input->>Input: ctx inputValue=""

    Messages->>Messages: guard phase=idle, ctx phase=creating
    Messages->>Messages: op.create (user bubble)
    Messages->>OSMsg: tell SEND_MESSAGE

    OSMsg->>AI: ask CHAT
    AI-->>OSMsg: SUCCESS
    OSMsg->>Messages: tell SUCCESS
    Messages->>Messages: op.create (assistant), ctx phase=idle
```



---

## 5. Error Path (Consolidated)

```mermaid
sequenceDiagram
    participant AI as os/ai
    participant OSMsg as os/messages
    participant Messages as messages
    participant Input as input

    AI-->>OSMsg: ERROR
    OSMsg->>Messages: tell $_pendingReplyTo ERROR

    Messages->>Messages: ctx hasError=true, error=$$errors, phase=error
    Messages->>Input: tell $targetInput ERROR

    Input->>Input: ctx hasError=true  (guard only, no display)
```



**Fix**: messages uses `$targetInput` (from layout @actors.input), not `°Maia/actor/views/input/for-chat`.

---

## 6. Dismiss Path (Consolidated - One Button)

```mermaid
sequenceDiagram
    participant User
    participant Messages as messages
    participant Input as input

    User->>Messages: click Dismiss (messages view only)
    Messages->>Messages: ctx phase=idle, hasError=false, error=null
    Messages->>Input: tell $targetInput DISMISS

    Input->>Input: ctx hasError=false
```



**Eliminated**: input's Dismiss button, input's DISMISS handler, $onlyWhenOriginated, bidirectional tells.

---

## 7. Universal Tell Pattern


| From        | To          | Use                       | Why                 |
| ----------- | ----------- | ------------------------- | ------------------- |
| input       | messages    | `$targetActor`            | Sibling (layout)    |
| messages    | input       | `$targetInput`            | Sibling (layout)    |
| messages    | os/messages | `°Maia/actor/os/messages` | Service (singleton) |
| os/messages | messages    | `$_pendingReplyTo`        | Dynamic (source)    |


**Rule**: View→View = layout sibling ref. View→Service = schema. Service→View = replyTo/source.

---

## 8. Implementation Checklist

### Milestone 1: Add targetInput to messages

- messages context: `targetInput: "@input"` (layout has @actors.input)
- messages process ERROR: `tell target: "$targetInput"`
- messages process DISMISS: `tell target: "$targetInput"`
- Remove `$onlyWhenOriginated` from messages DISMISS

### Milestone 2: Consolidate error to messages only

- input view: remove error-message div (entire block)
- input context: keep hasError (for guard), remove errorLabel, dismissButtonText
- input process: keep ERROR (ctx hasError), **remove DISMISS handler**
- input interface: remove DISMISS
- Session-scoped clear on mount: messages only (input gets DISMISS from messages)

### Milestone 3: Mount clear for reopen

- ViewEngine attachViewToActor: clear hasError for **messages** on fresh mount
- Verify layout-chat children get per-instance context (no shared CoValue)

### Debug: Trace mode

To diagnose error-state breaks or message loops:

1. **Enable trace**: `localStorage.setItem('maia:debug:trace', '1')` or `?maia_trace=1` in URL
2. **Logs**: `[Trace:View]` events from DOM, `[Trace:Inbox]` deliveries (from→to), `[Trace:Process]` handler runs, `[Trace:Context]` snapshot on ERROR
3. **Loop detection**: Warns when same event type bounces between same two actors ≥4 times in 2s
4. **Disable**: `localStorage.removeItem('maia:debug:trace')`

### Verification

- One Dismiss button (messages)
- Error displays only in messages area
- input blocks FORM_SUBMIT when hasError (guard)
- Open/close after error: messages clears on mount or via DISMISS
- Multi-agent chat: $targetInput resolves to sibling (no cross-talk)

