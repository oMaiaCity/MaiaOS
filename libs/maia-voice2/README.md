---
title: LFM2.5-Audio ASR Demo
emoji: 🎙️
colorFrom: indigo
colorTo: purple
sdk: static
app_file: dist/index.html
app_build_command: npm run build
pinned: false
license: other
models:
  - LiquidAI/LFM2.5-Audio-1.5B-ONNX
tags:
  - audio
  - speech
  - asr
  - webgpu
  - onnx
  - transformers.js
short_description: Speech-to-text in your browser
---

# maia-voice2 — ASR Demo

Speech-to-text in your browser via WebGPU and ONNX Runtime Web. Supports LFM2.5-Audio and Moonshine Streaming.

## Features

- **ASR (Speech Recognition)**: Live microphone transcription with VAD
- **Model choice**: LFM2.5-Audio-1.5B or Moonshine Streaming medium
- **VAD badges**: Marks utterance boundaries in the transcript

## Requirements

- WebGPU support (Chrome/Edge 113+)
- Enable at `chrome://flags/#enable-unsafe-webgpu` if needed

## Models

Pre-download models before running:

```bash
# LFM2.5-Audio Q4 (~1.6 GB)
bun run download:model

# Moonshine Streaming medium (~530 MB)
bun run download:moonshine
```

- **LFM2.5-Audio-1.5B-Q4**: [LiquidAI/LFM2.5-Audio-1.5B-ONNX](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-ONNX)
- **Moonshine Streaming medium**: [UsefulSensors/moonshine-streaming](https://huggingface.co/UsefulSensors/moonshine-streaming)

## License

- LFM2.5-Audio: [LFM 1.0 License](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-ONNX/blob/main/LICENSE)
- Moonshine Streaming: MIT
