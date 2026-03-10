# Maia AI

On-device local LLM and voice conversation via the [RunAnywhere Web SDK](https://github.com/RunanywhereAI/runanywhere-sdks).

## Overview

Maia AI provides private, offline-capable chat in two modes:

- **Text mode**: Type messages and receive LLM responses with streaming.
- **Voice mode**: Speak into the microphone; speech is transcribed, sent to the LLM, and the response is spoken back via TTS.

All inference runs 100% on-device. Once models are downloaded, no network connection is required.

## Models

### Text mode (LLM only)

| Model | Size | Purpose |
|-------|------|---------|
| LFM2.5 1.2B Instruct Q4_K_M | ~800MB | Text generation |

### Voice mode (4 models)

| Role | Model | Size |
|------|-------|------|
| VAD | Silero VAD v5 | ~5MB |
| STT | Whisper Tiny English | ~105MB |
| LLM | LFM2.5 1.2B Instruct Q4_K_M | ~800MB |
| TTS | Piper Alba (British English female) | ~65MB |

**Total voice download**: ~175MB extra (VAD + STT + TTS) when LLM is already present.

Models are cached in OPFS. After the first download, refresh/reload does not re-download.

## Browser support

- **Chrome/Edge 120+** (recommended): Full support including WebGPU and multi-threaded WASM.
- **Firefox 119+**: Supported (no WebGPU; falls back to CPU).
- **Safari 17+**: Basic support; OPFS reliability may vary. Chrome/Edge recommended for voice.

## Architecture

- `@MaiaOS/maia-ai`: Thin wrapper around RunAnywhere (init, model loading, voice pipeline).
- `@runanywhere/web`: Core SDK, VoicePipeline, AudioCapture, AudioPlayback.
- `@runanywhere/web-llamacpp`: LLM backend (llama.cpp WASM).
- `@runanywhere/web-onnx`: STT, TTS, VAD backend (sherpa-onnx WASM).

WASM files are served at `/runanywhere-wasm/` (llama.cpp) and `/runanywhere-wasm/sherpa/` (sherpa-onnx).

Maia AI voice mode uses the **RunAnywhere Voice Pipeline** (VAD + STT + LLM + TTS) for full conversation.
