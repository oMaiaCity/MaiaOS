# Maia AI

On-device VAD + STT voice-to-text via the [RunAnywhere Web SDK](https://github.com/RunanywhereAI/runanywhere-sdks).

## Overview

Maia AI provides private, offline-capable voice transcription:

- **Voice mode**: Speak into the microphone; VAD detects speech end, STT transcribes to text. Transcriptions are displayed in the UI.

All inference runs 100% on-device. Once models are downloaded, no network connection is required.

## Models

| Role | Model | Size |
|------|-------|------|
| VAD | Silero VAD v5 | ~5MB |
| STT | Whisper Base English | ~129MB |

**Total download**: ~134MB.

Models are cached in OPFS. After the first download, refresh/reload does not re-download.

## Browser support

- **Chrome/Edge 120+** (recommended): Full support including WebGPU and multi-threaded WASM.
- **Firefox 119+**: Supported (no WebGPU; falls back to CPU).
- **Safari 17+**: Basic support; OPFS reliability may vary. Chrome/Edge recommended for voice.

## Architecture

- `@MaiaOS/maia-ai`: Thin wrapper around RunAnywhere (init, VAD + STT model loading).
- `@runanywhere/web`: Core SDK, AudioCapture.
- `@runanywhere/web-onnx`: STT, VAD backend (sherpa-onnx WASM).

WASM files are served at `/runanywhere-wasm/sherpa/` (sherpa-onnx).
