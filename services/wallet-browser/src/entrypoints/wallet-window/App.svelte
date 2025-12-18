<script lang="ts">
  import svelteLogo from '../../assets/svelte.svg'
  import Counter from '../../lib/Counter.svelte'
  import { resizeWindow } from '../../lib/window-resize'

  let isWidescreen = false;
  
  // Default squared size
  const SQUARED_SIZE = 400;
  // 16:9 aspect ratio size (width calculated from height)
  const WIDESCREEN_HEIGHT = 400;
  const WIDESCREEN_WIDTH = Math.round(WIDESCREEN_HEIGHT * (16 / 9)); // ~711px

  async function toggleAspectRatio() {
    isWidescreen = !isWidescreen;
    
    if (isWidescreen) {
      // Switch to 16:9
      await resizeWindow(WIDESCREEN_WIDTH, WIDESCREEN_HEIGHT);
    } else {
      // Switch to squared
      await resizeWindow(SQUARED_SIZE, SQUARED_SIZE);
    }
  }
</script>

<div class="popup-container">
  <main>
    <div>
      <a href="https://wxt.dev" target="_blank" rel="noreferrer">
        <img src="/wxt.svg" class="logo" alt="WXT Logo" />
      </a>
      <a href="https://svelte.dev" target="_blank" rel="noreferrer">
        <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
      </a>
    </div>
    <div class="card">
      <Counter />
    </div>

    <p class="read-the-docs">
      Click on the WXT and Svelte logos to learn more
    </p>
    
    <button class="ratio-toggle" onclick={toggleAspectRatio}>
      {isWidescreen ? '16:9' : '1:1'}
    </button>
  </main>
</div>

<style>
  .popup-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Squared design - no rounded corners */
    border-radius: 0;
    /* Light mode background */
    background-color: #ffffff;
    /* Subtle border for definition */
    border: 1px solid #e0e0e0;
  }

  main {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 2rem 0 2rem; /* No bottom padding */
  }

  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #54bc4ae0);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #666;
  }

  .ratio-toggle {
    margin-top: 1rem;
    padding: 0.5em 1em;
    font-size: 0.9em;
    background-color: #646cff;
    color: white;
    border: none;
    cursor: pointer;
    transition: background-color 0.25s;
  }

  .ratio-toggle:hover {
    background-color: #535bf2;
  }
</style>
