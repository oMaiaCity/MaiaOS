<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from 'wxt/browser'

  // Get voice service domain from env (PUBLIC_DOMAIN_VOICE)
  // Default to localhost:4201 for development
  const VOICE_DOMAIN = 'localhost:4201'
  const VOICE_PROTOCOL = 'ws'
  const VOICE_WS_URL = `${VOICE_PROTOCOL}://${VOICE_DOMAIN}/api/v0/voice/live`

  let isConnected = $state(false)
  let isRecording = $state(false)
  let isSpeaking = $state(false)
  let isThinking = $state(false)
  const logs = $state<string[]>([])
  let error = $state<string | null>(null)

  let ws: WebSocket | null = null
  let audioContext: AudioContext | null = null
  let stream: MediaStream | null = null
  let processor: ScriptProcessorNode | null = null
  let input: MediaStreamAudioSourceNode | null = null
  let nextStartTime = 0
  const scheduledSources = new Set<AudioBufferSourceNode>()
  let isFirstAudioOfTurn = true

  function log(msg: string) {
    logs.push(`${new Date().toISOString().split('T')[1].slice(0, -1)} - ${msg}`)
  }

  /**
   * Check microphone permission status (if Permissions API is available)
   * Returns 'granted', 'denied', 'prompt', or null if API not available
   * Note: Permissions API may not work reliably in extension contexts
   */
  async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | null> {
    try {
      // Note: Permissions API may not work in extension contexts
      // But we'll try it anyway for informational purposes
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      return permissionStatus.state as 'granted' | 'denied' | 'prompt'
    } catch (err) {
      // Permissions API not available - this is fine, we'll proceed with getUserMedia
      return null
    }
  }

  /**
   * Request microphone access
   * This will trigger the browser's permission prompt
   */
  async function requestMicrophoneAccess(): Promise<MediaStream> {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  }

  /**
   * Request microphone permission via invisible iframe
   * This method is more reliable for triggering permission prompts in Chrome extensions
   * Based on: https://medium.com/@lynchee.owo/how-to-enable-microphone-access-in-chrome-extensions-by-code-924295170080
   */
  async function requestMicrophoneViaIframe(): Promise<void> {
    return new Promise((resolve, reject) => {
      log('Creating invisible iframe to request microphone permission...')
      
      // Create invisible iframe
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      iframe.setAttribute('allow', 'microphone')
      iframe.id = 'mic-permission-iframe'
      
      // Get the permission page URL
      // WXT exposes entrypoints as /mic-permission.html (based on directory name)
      const permissionPageUrl = browser.runtime.getURL('/mic-permission.html' as any)
      iframe.src = permissionPageUrl
      
      // Set up message listener for iframe response
      const messageHandler = (event: MessageEvent) => {
        // Verify message is from our iframe (check if it's from extension origin)
        const extensionOrigin = new URL(browser.runtime.getURL('/')).origin
        if (event.origin !== extensionOrigin) {
          return
        }
        
        if (event.data.type === 'microphone-permission-granted') {
          log('✅ Microphone permission granted via iframe')
          window.removeEventListener('message', messageHandler)
          document.body.removeChild(iframe)
          resolve()
        } else if (event.data.type === 'microphone-permission-denied') {
          log(`❌ Microphone permission denied via iframe: ${event.data.message}`)
          window.removeEventListener('message', messageHandler)
          document.body.removeChild(iframe)
          reject(new Error(event.data.message || 'Microphone permission denied'))
        }
      }
      
      window.addEventListener('message', messageHandler)
      
      // Handle iframe load errors
      iframe.onerror = () => {
        window.removeEventListener('message', messageHandler)
        document.body.removeChild(iframe)
        reject(new Error('Failed to load permission request page'))
      }
      
      // Add iframe to document
      document.body.appendChild(iframe)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler)
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
        reject(new Error('Microphone permission request timeout'))
      }, 10000)
    })
  }

  /**
   * Request microphone permission via opening a new tab
   * This is the most reliable method for permission prompts in extensions
   * The new tab context allows the permission prompt to appear properly
   */
  async function requestMicrophoneViaNewTab(): Promise<void> {
    return new Promise((resolve, reject) => {
      log('Opening new tab to request microphone permission...')
      log('💡 Please grant microphone permission in the new tab that opens')
      
      // Get the permission page URL
      const permissionPageUrl = browser.runtime.getURL('/mic-permission.html' as any)
      
      // Set up message listener FIRST before opening tab
      const messageListener = (message: any) => {
        if (message.type === 'microphone-permission-granted') {
          log('✅ Received permission granted message from new tab')
          browser.runtime.onMessage.removeListener(messageListener)
          browser.tabs.onUpdated.removeListener(tabUpdateListener)
          browser.tabs.onRemoved.removeListener(tabRemovedListener)
          clearTimeout(timeoutId)
          // Close the tab
          if (tabId) {
            browser.tabs.remove(tabId).catch(() => {})
          }
          resolve()
        }
      }
      
      browser.runtime.onMessage.addListener(messageListener)
      
      let tabId: number | null = null
      let permissionChecked = false
      let timeoutId: NodeJS.Timeout
      
      // Listen for tab updates to detect when tab loads
      const tabUpdateListener = async (id: number, changeInfo: any) => {
        if (id === tabId && changeInfo.status === 'complete' && !permissionChecked) {
          permissionChecked = true
          log('Permission tab loaded, waiting for permission grant...')
          
          // Also poll as backup (in case message doesn't come through)
          let attempts = 0
          const maxAttempts = 30 // 30 seconds
          const checkPermission = async () => {
            attempts++
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
              // Permission granted!
              stream.getTracks().forEach((track) => track.stop())
              browser.runtime.onMessage.removeListener(messageListener)
              browser.tabs.onUpdated.removeListener(tabUpdateListener)
              browser.tabs.onRemoved.removeListener(tabRemovedListener)
              clearTimeout(timeoutId)
              if (tabId) {
                browser.tabs.remove(tabId).catch(() => {})
              }
              log('✅ Permission granted (detected via polling)')
              resolve()
            } catch (err: any) {
              if (attempts < maxAttempts) {
                // Keep checking - user might still be granting permission
                setTimeout(checkPermission, 1000)
              }
              // Don't reject here - wait for timeout or message
            }
          }
          
          // Start polling after a short delay
          setTimeout(checkPermission, 2000)
        }
      }
      
      browser.tabs.onUpdated.addListener(tabUpdateListener)
      
      // Also listen for tab close - if user closes tab, they probably dismissed
      const tabRemovedListener = (id: number) => {
        if (id === tabId) {
          browser.runtime.onMessage.removeListener(messageListener)
          browser.tabs.onUpdated.removeListener(tabUpdateListener)
          browser.tabs.onRemoved.removeListener(tabRemovedListener)
          clearTimeout(timeoutId)
          if (!permissionChecked) {
            reject(new Error('Permission tab was closed before permission could be granted'))
          }
        }
      }
      
      browser.tabs.onRemoved.addListener(tabRemovedListener)
      
      // Timeout after 60 seconds
      timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener)
        browser.tabs.onUpdated.removeListener(tabUpdateListener)
        browser.tabs.onRemoved.removeListener(tabRemovedListener)
        if (tabId) {
          browser.tabs.remove(tabId).catch(() => {})
        }
        reject(new Error('Microphone permission request timeout - please grant permission in the new tab'))
      }, 60000)
      
      // Open permission page in new tab
      // Try direct tabs.create first (should work with tabs permission)
      log('Attempting to create permission tab...')
      log(`Permission page URL: ${permissionPageUrl}`)
      
      // Try direct tab creation (sidepanels can use tabs.create with tabs permission)
      log('Calling browser.tabs.create...')
      browser.tabs.create({ url: permissionPageUrl, active: true })
        .then((tab) => {
          log(`Tab creation response: ${JSON.stringify(tab)}`)
          if (!tab || !tab.id) {
            browser.runtime.onMessage.removeListener(messageListener)
            browser.tabs.onUpdated.removeListener(tabUpdateListener)
            browser.tabs.onRemoved.removeListener(tabRemovedListener)
            clearTimeout(timeoutId)
            log(`❌ Tab created but no tabId returned`)
            reject(new Error('Tab created but no tabId returned'))
            return
          }
          tabId = tab.id
          log(`✅ Permission tab opened with ID: ${tabId}`)
          log('Waiting for tab to load and request permission...')
          // Don't resolve here - wait for tab to load and permission to be granted
          // The tabUpdateListener will handle the rest
        })
        .catch((err: any) => {
          browser.runtime.onMessage.removeListener(messageListener)
          browser.tabs.onUpdated.removeListener(tabUpdateListener)
          browser.tabs.onRemoved.removeListener(tabRemovedListener)
          clearTimeout(timeoutId)
          log(`❌ Failed to create tab: ${err?.message || err}`)
          log(`Error stack: ${err?.stack || 'No stack trace'}`)
          reject(new Error(`Failed to create permission tab: ${err?.message || err}`))
        })
    })
  }

  async function startCall() {
    try {
      log('Starting voice call...')
      isFirstAudioOfTurn = true
      error = null

      // Check if we're in a secure context (required for getUserMedia)
      if (!window.isSecureContext) {
        error = 'Microphone access requires a secure context (HTTPS or localhost). Please ensure you are using a secure connection.'
        log('❌ Not in secure context - getUserMedia requires HTTPS or localhost')
        return
      }

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        error = 'Microphone access is not available in this context. Please ensure you are using a modern browser with media device support.'
        log('❌ mediaDevices API not available')
        return
      }

      // Audio Init
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioContext = new AudioContextClass({ sampleRate: 24000 })
      log(`AudioContext created: ${audioContext.state}`)

      // WebSocket Init
      ws = new WebSocket(VOICE_WS_URL)

      // Set up all handlers first
      let connectionResolve: (() => void) | null = null
      let connectionReject: ((error: Error) => void) | null = null
      const connectionPromise = new Promise<void>((resolve, reject) => {
        connectionResolve = resolve
        connectionReject = reject
      })

      const timeout = setTimeout(() => {
        if (connectionReject) {
          connectionReject(new Error('WebSocket connection timeout'))
        }
      }, 10000) // 10 second timeout

      ws.onopen = () => {
        log('WebSocket connected')
        isConnected = true
        clearTimeout(timeout)
        if (connectionResolve) {
          connectionResolve()
        }
      }

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'status') {
          log(`Status: ${msg.status}`)
          if (msg.status === 'disconnected') {
            isConnected = false
          }
        }
        if (msg.type === 'log') {
          log(msg.message)
        }
        if (msg.type === 'transcript') {
          log(`${msg.role === 'user' ? '👤' : '🤖'} ${msg.text}`)
          if (msg.role === 'user') {
            isFirstAudioOfTurn = true
          }
          if (msg.role === 'model') {
            isThinking = false
          }
        }
        if (msg.type === 'toolCall') {
          log(`🔧 Tool Call: ${msg.name} ${JSON.stringify(msg.args)}`)
          isThinking = true
        }
        if (msg.type === 'interrupted') {
          log('🛑 AI Interrupted')
          isFirstAudioOfTurn = true
          isThinking = false
          if (audioContext) {
            scheduledSources.forEach((source) => {
              try {
                source.stop()
              } catch (_e) {}
            })
            scheduledSources.clear()
            nextStartTime = audioContext.currentTime
            isSpeaking = false
          }
        }
        if (msg.type === 'audio') {
          if (isThinking) isThinking = false
          if (isFirstAudioOfTurn) {
            log('🔊 First audio chunk received')
            isFirstAudioOfTurn = false
          }
          isSpeaking = true
          await playAudio(msg.data)
        }
        if (msg.type === 'error') {
          error = msg.message
          log(`❌ Error: ${msg.message}`)
        }
      }

      ws.onerror = (_event) => {
        error = 'Connection error. Please try again.'
        log('WebSocket error occurred')
        clearTimeout(timeout)
        if (connectionReject) {
          connectionReject(new Error('WebSocket connection failed'))
        }
      }

      ws.onclose = (event) => {
        log(`WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`)
        isConnected = false
        clearTimeout(timeout)
        
        // Code 1000 = Normal Closure (user intentionally ended call)
        // Code 1005 = No Status Received (connection closed without close frame - also OK for user-initiated close)
        // Code 1001 = Going Away (server closed - also OK)
        const isNormalClose = event.code === 1000 || event.code === 1005 || event.code === 1001
        
        if (!isNormalClose) {
          // Only show error for unexpected closures
          const errorMsg = event.reason || `Connection error (code: ${event.code})`
          // Don't overwrite existing error (like microphone permission)
          if (!error) {
            error = errorMsg
          }
          log(`Error: ${errorMsg}`)
          if (connectionReject) {
            connectionReject(new Error(errorMsg))
          }
        } else {
          // Normal closure - clear any errors
          error = null
          if (connectionResolve) {
            connectionResolve()
          }
        }
        
        // Only stop call if it wasn't already stopped (e.g., by mic permission error or user action)
        // Check if stopCall was already called by checking if ws is null
        if ((isRecording || stream) && ws !== null) {
          // WebSocket closed unexpectedly, clean up resources
          stopCall()
        }
      }

      // Wait for WebSocket to open before proceeding with mic
      try {
        await connectionPromise
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'WebSocket connection failed'
        error = errorMsg
        log(`Error: ${errorMsg}`)
        if (ws) ws.close()
        return
      }

      // Mic Init - request microphone permission
      // IMPORTANT: Chrome extensions CANNOT declare 'microphone' in manifest permissions
      // Microphone access must be requested via getUserMedia() which triggers the browser's permission prompt
      // The request must be initiated by a user gesture (button click) - which we are doing
      // Note: Sidepanels may have limitations similar to popups - if prompt doesn't appear,
      //       consider opening an options page or new tab for permission request
      
      // Check permission status via Permissions API (if available)
      const permissionStatus = await checkMicrophonePermission()
      if (permissionStatus) {
        log(`Microphone permission status: ${permissionStatus}`)
        if (permissionStatus === 'granted') {
          log('✅ Microphone permission already granted')
        } else if (permissionStatus === 'denied') {
          error = 'Microphone permission was previously denied. Please reset permissions in browser settings (chrome://settings/content/microphone) and try again.'
          log('❌ Microphone permission was denied - user needs to reset in browser settings')
          isConnected = false
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'Microphone permission denied')
          }
          return
        } else if (permissionStatus === 'prompt') {
          log('⏳ Microphone permission not yet requested - will prompt user')
        }
      }

      // Request microphone access via getUserMedia
      // Try direct approach first, then fallback to iframe method if permission is denied
      // The iframe method is more reliable for triggering permission prompts in extensions
      let micPermissionGranted = false
      
      // First, try direct getUserMedia (may work if permission already granted)
      try {
        log('Requesting microphone access via getUserMedia (direct)...')
        stream = await requestMicrophoneAccess()
        log('✅ Microphone access granted')
        micPermissionGranted = true
      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to access microphone'
        
        // If permission denied, try new tab method first (most reliable)
        // Then fallback to iframe if user cancels new tab
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          log('Direct getUserMedia failed with permission error, trying new tab method...')
          try {
            await requestMicrophoneViaNewTab()
            // If new tab method succeeded, try getUserMedia again
            log('New tab permission granted, retrying getUserMedia...')
            stream = await requestMicrophoneAccess()
            log('✅ Microphone access granted via new tab method')
            micPermissionGranted = true
          } catch (tabErr: any) {
            // New tab method failed - log the error and try iframe as fallback
            log(`New tab method failed: ${tabErr?.message || tabErr}`)
            log('New tab method failed, trying iframe method...')
            try {
              await requestMicrophoneViaIframe()
              // If iframe method succeeded, try getUserMedia again
              log('Iframe permission granted, retrying getUserMedia...')
              stream = await requestMicrophoneAccess()
              log('✅ Microphone access granted via iframe method')
              micPermissionGranted = true
            } catch (iframeErr: any) {
              // All methods failed
              error = 'Microphone permission denied. A new tab should have opened - please grant permission there, or click the microphone icon in the address bar and select "Always allow".'
              log('❌ Microphone permission denied (all methods failed)')
              log('💡 Tip: Check if a new tab opened - grant permission there')
              log('💡 Alternative: Click the microphone icon in the address bar to allow access')
              log('💡 Settings: Open chrome://settings/content/microphone to manage permissions')
            }
          }
        } else if (err?.name === 'NotFoundError') {
          error = 'No microphone found. Please connect a microphone and try again.'
          log('❌ No microphone device found')
        } else if (err?.name === 'NotReadableError') {
          error = 'Microphone is being used by another application. Please close other apps using the microphone and try again.'
          log('❌ Microphone is busy or not readable')
        } else if (err?.name === 'OverconstrainedError') {
          error = 'Microphone does not support the required audio settings. Please try a different microphone.'
          log(`❌ Microphone constraints not supported: ${errorMsg}`)
        } else if (err?.name === 'SecurityError') {
          error = 'Microphone access blocked due to security restrictions. Ensure you are using HTTPS or localhost.'
          log(`❌ Security error: ${errorMsg}`)
        } else {
          error = `Microphone error: ${errorMsg}`
          log(`❌ Microphone error: ${errorMsg}`)
        }
      }
      
      // If we still don't have permission, handle the error
      if (!micPermissionGranted || !stream) {
        // Don't close WebSocket - keep it open so user can try again
        // Just stop the call setup
        isConnected = false
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Send error to server and close gracefully
          ws.close(1000, 'Microphone permission denied')
        }
        return
      }

      // Verify WebSocket is still open after mic permission granted
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log('Connection closed during mic init, aborting')
        if (stream) stream.getTracks().forEach((t) => t.stop())
        error = 'Connection lost during microphone initialization'
        isConnected = false
        return
      }

      const micContext = new AudioContext({ sampleRate: 16000 })
      input = micContext.createMediaStreamSource(stream)
      processor = micContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return

        const inputData = e.inputBuffer.getChannelData(0)

        // Convert Float32 to Int16
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        // Base64 encode
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)))

        ws.send(JSON.stringify({ type: 'audio', data: base64 }))
      }

      input.connect(processor)
      processor.connect(micContext.destination)
      isRecording = true
      log('Recording started')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start call'
      log(`Error: ${errorMsg}`)
      error = errorMsg
    }
  }

  async function playAudio(base64: string) {
    if (!audioContext) return

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0
    }

    const buffer = audioContext.createBuffer(1, float32.length, 24000)
    buffer.copyToChannel(float32, 0)

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)

    const startTime = Math.max(audioContext.currentTime, nextStartTime)
    source.start(startTime)
    nextStartTime = startTime + buffer.duration
    scheduledSources.add(source)

    source.onended = () => {
      scheduledSources.delete(source)
      if (audioContext && audioContext.currentTime >= nextStartTime) {
        isSpeaking = false
      }
    }
  }

  function stopCall() {
    log('Stopping call...')
    
    // Close WebSocket gracefully with proper close code
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Call ended by user') // Normal closure
      }
      ws = null
    }
    
    // Stop microphone stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
    
    // Disconnect audio processing nodes
    if (processor) {
      processor.disconnect()
      processor = null
    }
    if (input) {
      input.disconnect()
      input = null
    }

    // Stop all scheduled audio playback
    scheduledSources.forEach((s) => {
      try {
        s.stop()
      } catch (_e) {}
    })
    scheduledSources.clear()

    // Close audio context
    if (audioContext) {
      audioContext.close().catch(() => {}) // Ignore errors if already closed
      audioContext = null
    }

    // Reset state
    isConnected = false
    isRecording = false
    isSpeaking = false
    isThinking = false
    error = null // Clear any errors
    nextStartTime = 0
  }

  // Cleanup on unmount
  onMount(() => {
    return () => {
      stopCall()
    }
  })
</script>

<div class="voice-call-container">
  <div class="voice-header">
    <h2 class="voice-title">Voice Assistant</h2>
    <div class="status-indicator" class:connected={isConnected} class:recording={isRecording} class:speaking={isSpeaking}>
      <span class="status-dot"></span>
      <span class="status-text">
        {#if isConnected}
          {#if isRecording}
            Recording...
          {:else if isSpeaking}
            Speaking...
          {:else if isThinking}
            Thinking...
          {:else}
            Connected
          {/if}
        {:else}
          Disconnected
        {/if}
      </span>
    </div>
  </div>

  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  <div class="voice-controls">
    {#if !isConnected}
      <button class="btn-start" onclick={startCall} disabled={isConnected}>
        Start Call
      </button>
    {:else}
      <button class="btn-stop" onclick={stopCall}>
        End Call
      </button>
    {/if}
  </div>

  {#if logs.length > 0}
    <div class="logs-container">
      <h3 class="logs-title">Activity Log</h3>
      <div class="logs">
        {#each logs as log (log)}
          <div class="log-entry">{log}</div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-call-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .voice-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .voice-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #64748b;
    transition: background 0.2s;
  }

  .status-indicator.connected .status-dot {
    background: #10b981;
  }

  .status-indicator.recording .status-dot {
    background: #ef4444;
    animation: pulse 1s infinite;
  }

  .status-indicator.speaking .status-dot {
    background: #3b82f6;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .error-message {
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #fca5a5;
    font-size: 0.875rem;
  }

  .voice-controls {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-start,
  .btn-stop {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-start {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .btn-start:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
  }

  .btn-start:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-stop {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  .btn-stop:hover {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
  }

  .logs-container {
    margin-top: 1rem;
  }

  .logs-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .logs {
    max-height: 200px;
    overflow-y: auto;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(100, 149, 237, 0.15);
    border-radius: 4px;
    padding: 0.75rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    color: #cbd5e1;
  }

  .log-entry {
    margin-bottom: 0.25rem;
    word-break: break-word;
  }

  .log-entry:last-child {
    margin-bottom: 0;
  }
</style>
