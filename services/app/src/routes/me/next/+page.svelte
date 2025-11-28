<script lang="ts">
    import { createVoiceCallNextService } from '@hominio/brand';
    
    const voice = createVoiceCallNextService();
</script>

<div class="p-8 max-w-2xl mx-auto space-y-8">
    <h1 class="text-3xl font-bold text-black dark:text-white">Voice Next - Minimal Test</h1>
    
    <div class="flex gap-4">
        <button 
            style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold;"
            onclick={() => voice.start()}
            disabled={voice.isConnected}
        >
            Start Call
        </button>
        
        <button 
            style="background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold;"
            onclick={() => voice.stop()}
            disabled={!voice.isConnected}
        >
            Stop Call
        </button>
    </div>

    <div class="grid grid-cols-3 gap-4 text-center">
        <div class="p-4 bg-gray-100 rounded-lg dark:bg-gray-800">
            <div class="text-sm text-gray-500">Connection</div>
            <div class="text-lg font-mono" class:text-green-600={voice.isConnected}>{voice.isConnected ? 'CONNECTED' : 'DISCONNECTED'}</div>
        </div>
        <div class="p-4 bg-gray-100 rounded-lg dark:bg-gray-800">
            <div class="text-sm text-gray-500">Mic</div>
            <div class="text-lg font-mono" class:text-red-600={voice.isRecording}>{voice.isRecording ? 'RECORDING' : 'OFF'}</div>
        </div>
        <div class="p-4 bg-gray-100 rounded-lg dark:bg-gray-800">
            <div class="text-sm text-gray-500">AI Status</div>
            <div class="text-lg font-mono font-bold" 
                 class:text-blue-600={voice.isSpeaking}
                 class:text-purple-600={voice.isThinking}
                 class:text-gray-500={!voice.isSpeaking && !voice.isThinking}>
                {#if voice.isSpeaking}
                    SPEAKING
                {:else if voice.isThinking}
                    THINKING
                {:else if voice.isConnected}
                    LISTENING
                {:else}
                    IDLE
                {/if}
            </div>
        </div>
    </div>

    <div class="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
        {#each voice.logs as log}
            <div>{log}</div>
        {/each}
    </div>
</div>
