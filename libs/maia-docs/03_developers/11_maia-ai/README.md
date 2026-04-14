# Maia AI shell (app)

The SPA **FAB + modal** in `services/app/maia-ai-global.js` is a **text chat** to the same Chat vibe / messages actor pipeline as the main Chat UI. LLM calls go through the sync server **RedPill proxy** (`POST /api/v0/llm/chat`) with UCAN capability grants — not a separate on-device STT stack.

On-device RunAnywhere / voice (VAD, STT) was removed to shrink dependencies and attack surface.
