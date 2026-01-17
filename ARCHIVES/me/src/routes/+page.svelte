<script lang="ts">
  import { setupComputedFieldsForCoValue } from "@maia/db";
  import { Image } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import { getJazzAccountContext } from "$lib/utils/jazz-account-context";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Get global Jazz account from context
  const account = getJazzAccountContext();
  const me = $derived(account ? account.current : null);

  // Set up computed fields for profile when it's loaded
  $effect(() => {
    if (me && me.$isLoaded && me.profile?.$isLoaded) {
      setupComputedFieldsForCoValue(me.profile);
    }
  });

  // Get profile image for display
  const profileImage = $derived(
    me &&
      me.$isLoaded &&
      me.profile?.$isLoaded &&
      (me.profile as any).$jazz.has("image") &&
      (me.profile as any).image &&
      (me.profile as any).image.$isLoaded
      ? (me.profile as any).image
      : null,
  );

  // Milestone Calculation: March 21, 2042
  const targetDate = new Date('2042-03-21');
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Mock data for VLogs
  const vlogs = [
    { id: 1, title: "Day 1: The Vision", thumbnail: "/brand/MaiaCity.svg" },
    { id: 2, title: "Day 12: Architecture", thumbnail: "/brand/MaiaCity.svg" },
    { id: 3, title: "Day 45: Sovereignty", thumbnail: "/brand/MaiaCity.svg" },
    { id: 4, title: "Day 89: Abundance", thumbnail: "/brand/MaiaCity.svg" },
  ];
</script>

<div class="w-full h-full overflow-y-auto bg-white">
  {#if isBetterAuthPending}
    <div class="max-w-6xl mx-auto px-6 pt-8 pb-4 text-center">
      <p class="text-slate-500 font-mono italic animate-pulse">Synchronizing with MaiaCity...</p>
    </div>
  {:else if !isBetterAuthSignedIn}
    <!-- Visionary Landing Page -->
    <div class="space-y-32 pb-32">
      <!-- Full Width Hero Banner -->
      <header class="relative w-full aspect-video min-h-[500px] md:min-h-[700px] flex items-end justify-center overflow-hidden pb-12 md:pb-24">
        <!-- Background Image -->
        <img
          src="/brand/images/banner.png"
          alt="Maia City Capital Banner"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <!-- Dark Overlay for Readability -->
        <div class="absolute inset-0 bg-black/10"></div>

        <!-- Overlay Content -->
        <div class="relative z-10 text-center px-6 w-full max-w-4xl mx-auto space-y-8">
          <div class="max-w-2xl mx-auto bg-black/5 backdrop-blur-[2px] p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <h1 class="text-2xl md:text-4xl font-black text-white leading-[1.1] tracking-tighter text-balance drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
              Can <span class="italic font-serif text-[#A5C46D]">1,346,269</span> humans cooperate to build a 10x greater city from the ground up?
            </h1>
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <div class="max-w-6xl mx-auto px-6 space-y-32">
        <!-- Intro Hook Content -->
        <div class="text-center space-y-12 py-12 border-b border-[#3D895A]/10">
          <div class="space-y-4">
            <p class="text-2xl md:text-4xl font-black text-[#1F4269] tracking-tight text-balance">
              In exactly <span class="text-[#A5C46D]">{diffDays.toLocaleString()} days</span>, on March 21 2042, <br class="hidden md:block" /> we will find out.
            </p>
          </div>
          <p class="text-xl md:text-2xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed text-balance">
            Maia City is the new capital of Earth. A democratic participation project 
            for sovereign humans, building and owning their future 
            rooted in purpose, abundance, and ownership.
          </p>
        </div>

        <!-- Founders VLog Section -->
        <section class="space-y-8">
          <div class="flex items-end justify-between border-b border-[#3D895A]/20 pb-4">
            <div class="space-y-1">
              <h3 class="text-2xl font-black text-[#1F4269]">City Founders' Daily Progress</h3>
              <p class="text-sm text-slate-500 font-mono uppercase tracking-widest font-bold">Building from the ground up</p>
            </div>
            <div class="hidden md:flex gap-2">
              <button aria-label="Previous VLog" class="p-2 rounded-full border border-[#3D895A]/20 text-[#3D895A] hover:bg-[#3D895A]/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button aria-label="Next VLog" class="p-2 rounded-full border border-[#3D895A]/20 text-[#3D895A] hover:bg-[#3D895A]/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            {#each vlogs as vlog}
              <div class="group relative aspect-video bg-[#F5F1CE] rounded-2xl overflow-hidden border border-[#3D895A]/10 hover:border-[#3D895A]/40 transition-all cursor-pointer shadow-sm hover:shadow-md">
                <div class="absolute inset-0 flex items-center justify-center">
                  <img src={vlog.thumbnail} alt="" class="w-16 h-16 opacity-10 grayscale group-hover:opacity-20 transition-opacity" />
                </div>
                <div class="absolute inset-0 bg-linear-to-t from-[#1F4269]/60 to-transparent flex flex-col justify-end p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span class="text-[10px] font-mono text-white/80 uppercase tracking-tighter">VLog #{vlog.id}</span>
                  </div>
                  <p class="text-white font-bold text-sm truncate">{vlog.title}</p>
                </div>
                <div class="absolute inset-0 bg-[#3D895A]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-[#3D895A] shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z"/></svg>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </section>

        <!-- The Great Transition: Convergent Conviction -->
        <section class="max-w-4xl mx-auto py-16 bg-[#F5F1CE]/50 rounded-4xl border border-[#3D895A]/10">
          <div class="space-y-8 text-center px-6">
            <h3 class="text-3xl md:text-4xl font-black text-[#1F4269] leading-tight text-balance">
              The world is changing. <br class="hidden md:block" /> 
              Most are watching the disruption. <span class="text-[#3D895A]">We are building the beyond.</span>
            </h3>
            <div class="space-y-6 text-lg text-slate-700 max-w-3xl mx-auto leading-relaxed text-balance">
              <p>
                Nobody truly understands what is coming. AI is not just disrupting jobs—it is dissolving the very 
                foundation of the 20th-century economy. When human labor is no longer the engine of value, 
                the traditional world economy reaches its final chapter.
              </p>
              <p class="font-bold text-[#1F4269]">
                While others fear the collapse, we recognize the liberation.
              </p>
              <p>
                The true challenge isn't earning a living—it's discovering what to do with a life. 
                We have 100% conviction that the end of labor is the beginning of the human potential. 
                Maia City is where we build the infrastructure for that purpose.
              </p>
            </div>
          </div>
        </section>

        <!-- The WHY: Human Purpose -->
        <section class="grid md:grid-cols-2 gap-12 items-center">
          <div class="space-y-6 text-balance">
            <div class="inline-block px-4 py-1 bg-[#F5F1CE] text-[#1F4269] rounded-full text-xs font-bold uppercase tracking-widest border border-[#3D895A]/20">
              Why Maia City?
            </div>
            <h3 class="text-4xl font-bold text-[#1F4269]">The Path to Abundance</h3>
            <p class="text-lg text-slate-600 leading-relaxed">
              As AI replaces traditional labor, we are creating a global destination where humans 
              thrive through <strong>asset ownership</strong> instead of employment. Maia City is 
              the transition from earning a living to owning a future—where your purpose generates 
              multiple income streams through the city's shared technological and physical assets.
            </p>
            <div class="flex items-center gap-4 text-[#3D895A]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>
              <span class="font-bold text-[#1F4269]">Ownership is the baseline for human purpose.</span>
            </div>
          </div>
          <div class="relative group">
            <div class="absolute -inset-1 bg-[#3D895A]/20 rounded-4xl blur-2xl group-hover:bg-[#3D895A]/30 transition-all duration-1000"></div>
            <div class="relative bg-[#F5F1CE] rounded-4xl overflow-hidden border-4 border-[#A5C46D]/30 shadow-2xl transition-transform duration-700 hover:scale-[1.02]">
              <img
                src="/brand/images/maiacity-render1.png"
                alt="Maia City Vision"
                class="w-full h-full object-cover aspect-square"
              />
            </div>
          </div>
        </section>

        <!-- The Road to Earth's New Capital: Milestones -->
        <section class="space-y-16">
          <div class="text-center space-y-4">
            <div class="inline-block px-4 py-1 bg-[#F5F1CE] text-[#1F4269] rounded-full text-xs font-bold uppercase tracking-widest border border-[#3D895A]/20">
              The Roadmap to Abundance
            </div>
            <h3 class="text-4xl md:text-5xl font-black text-[#1F4269] tracking-tighter">4 Phases of Asset Ownership</h3>
          </div>

        <div class="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <!-- Phase 1 -->
          <div class="p-8 rounded-[2.5rem] bg-white border border-[#3D895A]/10 hover:border-[#3D895A]/30 transition-all shadow-sm hover:shadow-xl group">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 rounded-2xl bg-[#F5F1CE] flex items-center justify-center text-[#3D895A] shrink-0 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </div>
              <div class="space-y-3">
                <h4 class="text-xs font-black text-[#3D895A] uppercase tracking-widest text-balance">Phase 1: The Multiplayer Simulation</h4>
                <h5 class="text-xl font-bold text-[#1F4269] leading-tight text-balance">Democratic Economy Game</h5>
                <p class="text-slate-600 text-sm leading-relaxed">
                  Experience how income works in a post-abundance AGI world. Together, we design the city in a 100% 3D 
                  simulation—modeling resource flows and testing a new democratic OS before it manifests in physical reality.
                </p>
              </div>
            </div>
          </div>

          <!-- Phase 2 -->
          <div class="p-8 rounded-[2.5rem] bg-white border border-[#3D895A]/10 hover:border-[#3D895A]/30 transition-all shadow-sm hover:shadow-xl group">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 rounded-2xl bg-[#F5F1CE] flex items-center justify-center text-[#3D895A] shrink-0 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              </div>
              <div class="space-y-3">
                <h4 class="text-xs font-black text-[#3D895A] uppercase tracking-widest text-balance">Phase 2: Digital Agent Assets</h4>
                <h5 class="text-xl font-bold text-[#1F4269] leading-tight text-balance">MaiaOS: The Vibe Marketplace</h5>
                <p class="text-slate-600 text-sm leading-relaxed">
                  The road to sovereignty starts with digital assets. Build voice-enabled "Vibes" with Maia AI and 
                  own them as income-generating agents in our global marketplace. Replace labor with automated value.
                </p>
              </div>
            </div>
          </div>

          <!-- Phase 3 -->
          <div class="p-8 rounded-[2.5rem] bg-white border border-[#3D895A]/10 hover:border-[#3D895A]/30 transition-all shadow-sm hover:shadow-xl group">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 rounded-2xl bg-[#F5F1CE] flex items-center justify-center text-[#3D895A] shrink-0 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div class="space-y-3">
                <h4 class="text-xs font-black text-[#3D895A] uppercase tracking-widest text-balance">Phase 3: Physical & Tech Assets</h4>
                <h5 class="text-xl font-bold text-[#1F4269] leading-tight text-balance">Maia Village: The Innovation Hub</h5>
                <p class="text-slate-600 text-sm leading-relaxed">
                  The primary breeding ground for physical invention near the Mediterranean. Own a piece of the 
                  startups building the city's backbone: autonomous drones, robotics, and sustainable housing.
                </p>
              </div>
            </div>
          </div>

          <!-- Phase 4 -->
          <div class="p-8 rounded-[2.5rem] bg-white border border-[#3D895A]/10 hover:border-[#3D895A]/30 transition-all shadow-sm hover:shadow-xl group">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 rounded-2xl bg-[#F5F1CE] flex items-center justify-center text-[#3D895A] shrink-0 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M18 22V11a2 2 0 0 0-2-2h-2"/><path d="M2 22v-3a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3"/></svg>
              </div>
              <div class="space-y-3">
                <h4 class="text-xs font-black text-[#3D895A] uppercase tracking-widest text-balance">Phase 4: Economic Ownership</h4>
                <h5 class="text-xl font-bold text-[#1F4269] leading-tight text-balance">Manifesting the Physical City</h5>
                <p class="text-slate-600 text-sm leading-relaxed text-balance">
                  Securing actual real estate purchase options to anchor the vision in physical land. Every Sovereign 
                  Human owns a direct piece of the overall Maia City Economy—the new planetary capital.
                </p>
              </div>
            </div>
          </div>
        </div>
        </section>

        <!-- The HOW: Sovereign Technology & The Sovereign Human -->
        <section class="bg-[#1F4269] rounded-[3rem] p-12 md:p-20 text-white space-y-16 border-b-8 border-[#3D895A]">
          <div class="max-w-3xl space-y-6 text-center mx-auto text-balance">
            <div class="inline-block px-4 py-1 bg-[#3D895A]/30 text-[#A5C46D] rounded-full text-xs font-bold uppercase tracking-widest border border-[#A5C46D]/30">
              The Era of Sovereign Humans
            </div>
            <h3 class="text-4xl md:text-5xl font-bold leading-tight">Sovereign Humans building from the ground up a new generation of sustainable cities</h3>
            <p class="text-xl text-slate-300 leading-relaxed font-light">
              The era of the "employee" is ending. Maia City is built by Sovereign Humans—those 
              who own their own future and turn their purpose into value. Using Maia AI, we build a 
              new generation of sustainable assets that generate abundance for those who create them.
            </p>
          </div>
          
          <div class="grid md:grid-cols-3 gap-8 text-left">
            <!-- Vibe Coding -->
            <div class="space-y-4 p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-[#A5C46D]/50 transition-all group">
              <div class="w-12 h-12 rounded-2xl bg-[#3D895A]/20 flex items-center justify-center text-[#A5C46D] group-hover:bg-[#3D895A]/40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              </div>
              <h4 class="text-xl font-bold text-white text-balance">Direct Creation</h4>
              <p class="text-slate-400 text-sm leading-relaxed">
                Every human becomes a creator. Build powerful "Voice Agents" just by talking to Maia AI. 
                Automate your challenges and monetize your solutions without barriers. 
                Your voice is your sovereignty.
              </p>
            </div>

            <!-- Marketplace -->
            <div class="space-y-4 p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-[#A5C46D]/50 transition-all group">
              <div class="w-12 h-12 rounded-2xl bg-[#3D895A]/20 flex items-center justify-center text-[#A5C46D] group-hover:bg-[#3D895A]/40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <h4 class="text-xl font-bold text-white text-balance">Sovereign Marketplace</h4>
              <p class="text-slate-400 text-sm leading-relaxed">
                Every agent you create is yours. They become digital infrastructure 
                available for all to use, scaling your impact and autonomy across 
                the entire city foundation.
              </p>
            </div>

            <!-- Revenue Sharing -->
            <div class="space-y-4 p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-[#A5C46D]/50 transition-all group">
              <div class="w-12 h-12 rounded-2xl bg-[#3D895A]/20 flex items-center justify-center text-[#A5C46D] group-hover:bg-[#3D895A]/40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h4 class="text-xl font-bold text-white text-balance">True Abundance</h4>
              <p class="text-slate-400 text-sm leading-relaxed">
                The engine of sovereignty. Every time a human uses your agent, 
                you are paid directly. This is the baseline for a life lived in 
                abundance, free from traditional labor.
              </p>
            </div>
          </div>
        </section>

        <!-- The WHAT: The Capital -->
        <section class="text-center max-w-5xl mx-auto space-y-16">
          <div class="space-y-4">
            <div class="inline-block px-4 py-1 bg-[#F5F1CE] text-[#1F4269] rounded-full text-xs font-bold uppercase tracking-widest border border-[#3D895A]/20">
              The Vision
            </div>
            <h3 class="text-4xl md:text-6xl font-black text-[#1F4269] tracking-tighter">The Capital of a New Earth</h3>
          </div>
          
          <p class="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-medium text-balance">
            A vision of a city built from scratch, owned by Sovereign Humans around the world, 
            and optimized for the flourishing of human potential. Harmony with nature, abundance 
            for all, and the power to own your future.
          </p>
          <div class="pt-8 pb-32">
            <button
              onclick={() => {
                const loginBtn = document.querySelector('button[onclick*="handleGoogleSignIn"]');
                if (loginBtn) (loginBtn as HTMLElement).click();
              }}
              class="px-16 py-6 bg-[#0A274D] hover:bg-[#1F4269] text-white font-bold text-2xl rounded-full transition-all shadow-[0_20px_50px_rgba(10,39,77,0.3)] hover:scale-105 active:scale-95 flex items-center justify-center gap-4 mx-auto group w-full max-w-md"
            >
              Talk to Maia
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </section>
      </div>
    </div>
  {:else if !me || !me.$isLoaded}
    <div class="max-w-6xl mx-auto px-6 text-center pt-8 pb-4">
      <p class="text-slate-500 font-mono">Initializing Account...</p>
    </div>
  {:else if me && me.$isLoaded}
    <div class="max-w-6xl mx-auto px-6 py-12">
      <!-- Welcome Section -->
      <header class="text-center pb-4">
        <!-- Profile Image -->
        {#if profileImage}
          <div class="flex justify-center mb-10">
            <div
              class="relative w-48 h-48 rounded-full overflow-hidden border-8 border-white shadow-2xl"
            >
              <Image
                imageId={profileImage.$jazz.id}
                width={192}
                height={192}
                alt="Profile"
                class="w-full h-full object-cover"
              />
            </div>
          </div>
        {/if}
        <h1
          class="text-5xl font-black bg-clip-text text-transparent bg-linear-to-br from-[#1F4269] to-[#3D895A] tracking-tighter mb-4"
        >
          Welcome Back, <span
            class="text-[#3D895A] italic font-serif"
          >
            {(me.profile &&
              (me.profile as any).$isLoaded &&
              (me.profile as any).name) ||
              "Sovereign Human"}
          </span>
        </h1>
        <div
          class="mt-4 inline-flex items-center px-4 py-2 rounded-full bg-white border border-[#3D895A]/10 shadow-sm"
        >
          <span class="text-xs font-black text-[#1F4269] uppercase tracking-widest">Human ID: </span>
          <span class="ml-3 font-mono text-xs text-slate-400">{me.$jazz.id}</span>
        </div>
      </header>
    </div>
  {/if}
</div>
