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

# LFM2.5-Audio ASR Demo

Transcription only (speech → text) using [LFM2.5-Audio-1.5B](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B) in your browser via WebGPU and ONNX Runtime Web.

## Features

- **ASR (Speech Recognition)**: Record or upload audio to transcribe to text

## Requirements

- A browser with WebGPU support (Chrome/Edge 113+)
- Enable WebGPU at `chrome://flags/#enable-unsafe-webgpu` if needed

## Model

Uses quantized ONNX models (decoder, audio_encoder, embed_tokens) from [LiquidAI/LFM2.5-Audio-1.5B-ONNX](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-ONNX).

## License

Model weights are released under the [LFM 1.0 License](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-ONNX/blob/main/LICENSE).
