# @MaiaOS/maia-voice

On-device speech-to-text for MaiaOS. Wraps [@usefulsensors/moonshine-js](https://www.npmjs.com/package/@usefulsensors/moonshine-js) (Moonshine) with a simple API for streaming transcription from the microphone.

## Usage

```javascript
import { createMicrophoneTranscriber } from '@MaiaOS/maia-voice'

const transcriber = createMicrophoneTranscriber({
  onUpdate(text) {
    // Real-time streaming updates as you speak
    console.log('update:', text)
  },
  onCommit(text) {
    // Called when a segment is committed (e.g. after pause)
    console.log('commit:', text)
  },
})

await transcriber.start()
// ... later
transcriber.stop()
```

## API

### `createMicrophoneTranscriber(opts)`

- **opts.useVAD** `boolean` (default: true) – Use Voice Activity Detection; transcripts arrive on commit (when you pause)
- **opts.onPermissionsRequested** `() => void` – Called when mic permission is requested
- **opts.onModelLoadStarted** `() => void` – Called when model loading begins
- **opts.onModelLoaded** `() => void` – Called when model and VAD are loaded (ready to transcribe)
- **opts.onTranscribeStarted** `() => void` – Called when mic is active and transcription has started
- **opts.onTranscribeStopped** `() => void` – Called when transcription stopped
- **opts.onUpdate** `(text: string) => void` – Streaming transcript updates (only when useVAD=false)
- **opts.onCommit** `(text: string) => void` – Called when a segment is committed (on pause with VAD)
- **opts.onError** `(err) => void` – Called on error

Returns `{ start(): Promise<void>, stop(): void }`

## Privacy

All audio is processed locally in the browser. No cloud services; no audio is sent to external servers.
