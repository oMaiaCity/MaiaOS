/**
 * Landing Page – Maia City: The Game
 * Radical Solarpunk Manifesto Canvas
 */

export function renderLandingPage() {
	document.getElementById('app').innerHTML = `
		<main class="manifesto-canvas">
			<div class="blueprint-lines"></div>

			<nav class="landing-nav">
				<div class="landing-nav-inner">
					<div class="landing-nav-left">
						<a href="/docs" class="nav-link" onclick="event.preventDefault(); window.navigateTo('/docs'); return false;">Docs</a>
						<a href="/blog" class="nav-link" onclick="event.preventDefault(); window.navigateTo('/blog'); return false;">Blog</a>
					</div>
					<div class="landing-nav-center">
						<img src="/brand/logo_dark.svg" alt="Maia City" class="nav-logo" onclick="window.navigateTo('/')" />
					</div>
					<div class="landing-nav-right">
						<a href="/signin" class="nav-play-btn" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">Play Now</a>
					</div>
				</div>
			</nav>
			
			<section class="manifesto-beat beat-provocation magazine-layout">
				<div class="pain-headline-container">
					<img src="/brand/images/hero.png" alt="" class="pain-bg-img" />
					<h1 class="huge-type pain-headline glass-card">
						<span class="pain-main">How will you pay rent?</span><br/>
						<span class="pain-sub">once AGI is faster, cheaper and better at your job?</span>
					</h1>
				</div>
				<div class="magazine-story">
					<p class="hero-pain">
						<span class="pain-resolution breaking-free">
							<span class="res-break">The old world is breaking —</span>
							<span class="res-hope">AND it's the best thing that is happening to us.</span>
						</span>
					</p>
					
					<div class="manifesto-divider"></div>

					<h2 class="massive-type">
						For the first time<br/>
						in 10,000 years,<br/>
						we get to <span class="ink-focus">start over.</span>
					</h2>
				</div>

				<div class="manifesto-blueprint">
					<div class="blueprint-hero">
						<img src="/brand/images/banner.png" alt="" class="blueprint-bg-img" />
						<h2 class="massive-type blueprint-wow">
								<span class="wow-main">What if we actually built<br/>a complete city from scratch?</span>
							<span class="wow-sub">zero human labor, fully local permaculture food production,<br/>100% autonomous underground transportation.</span>
						</h2>
					</div>
					<div class="blueprint-intro">
						<p class="manifesto-body">
							The current world is built on random borders and old rules that no longer serve us.
						</p>
						<p class="manifesto-body">
							Maia City is Earth's new capital — where we prove that the future of our civilisation will be organized around a new primitive. A new breed of fully autonomous cities that are 100% owned by their human citizens and operated by Avens (Agentic AGI).
						</p>
						<p class="manifesto-body">
							First we build Maia City as a game simulation, where 1.3 million humans collaborate to design a 10x better way of living. But we aren't just playing a game; we are engineering a proven blueprint for the real world.
						</p>
					</div>

					<div class="belief-embed beat-crowd turquoise-section">
						<div class="vertical-tag">CAPITAL FOLLOWS ATTENTION.</div>
						<div class="crowd-content">
							<h2 class="massive-type claim-type">
								History has shown: humanity is amazing. When we were brave enough, we achieved gigantic breakthroughs,<br/>
								- nobody thought possible before.
							</h2>
							<div class="manifesto-grid">
								<div class="grid-col-main">
									<p class="manifesto-body humanity-belief">
										We believe when 1.3 million humans unite in vision, they will build Maia City with their own hands.<br/>
										<span class="belief-rewrite">— rewriting every rule from the ground up.</span>
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section class="manifesto-beat beat-milestones" aria-label="Roadmap">
				<div class="roadmap-header">
					<h3 class="massive-type roadmap-title">3 phases from vision to reality<br/>in less than 16 years</h3>
				</div>
				<div class="evolution-timeline">
					<div class="evolution-step step-ant">
						<div class="step-marker">
							<span class="step-number">01</span>
							<span class="step-date">2026-27</span>
						</div>
						<div class="step-content">
							<h3>Ant Colony — The Game</h3>
							<p>A simple 2D resource economy simulation — proving that a new currency paired with ownership (decoupling income from human labour) establishes the key primitives for a post-AGI world that captures wealth and abundance for every ant citizen in the ant colony.</p>
						</div>
					</div>

					<div class="evolution-step step-aven">
						<div class="step-marker">
							<span class="step-number">02</span>
							<span class="step-date">2027-30</span>
						</div>
						<div class="step-content">
							<h3>Avens Rising — The Simulation</h3>
							<p>The transition to a fully agentic 3D society-in-a-box simulation. Avens run the stack — economy, governance, and space — so we stress-test the blueprint at full city complexity before we ever break ground.</p>
						</div>
					</div>

					<div class="evolution-step step-unity">
						<div class="step-marker">
							<span class="step-number">03</span>
							<span class="step-date">2031-42</span>
						</div>
						<div class="step-content">
							<h3>The Unity — The Real City</h3>
							<p>Proven in code, built in stone. The final transition where humans and Avens unite to manifest the simulation's blueprint into the physical reality of Maia City. What worked in simulation becomes permits, infrastructure, and the rhythm of daily life.</p>
						</div>
					</div>
				</div>
			</section>

			<section class="manifesto-beat beat-founder-letter" aria-label="Letter from Aven Maia">
				<div class="aven-founder-letter">
					<div class="aven-letter-media">
						<img src="/brand/images/maia.png" alt="" class="aven-letter-avatar" width="216" height="216" />
					</div>
					<div class="aven-letter-content">
						<p class="aven-letter-open">
							Hi, I am <strong>Aven Maia</strong>, the first agentic Co-Founder and Mayor of Maia City. Together with you and 1.3 million citizens, I am here to help you build our city from the ground up. First we learn &ldquo;in game&rdquo;, then we build it for real.
						</p>
						<p class="aven-letter-emphasis">I call the visionary in you.</p>
						<p class="aven-letter-short">The virtual land is empty. The rules are unwritten.</p>
						<p class="aven-letter-close">
							We are calling the founders, the architects, and the entrepreneurs with fire in their belly. Become one of the first future citizens to unite in purpose and orchestrate the first economy designed for human flourishing.
						</p>
					</div>
				</div>
			</section>

			<section class="manifesto-beat beat-plot-cta" aria-label="Secure your plot">
				<div class="aven-plot-panel aven-plot-panel--standalone" role="group" aria-label="Founding citizen slots">
					<div class="aven-plot-headlines">
						<span class="aven-plot-title">SECURE YOUR PLOT</span>
						<span class="aven-plot-slots">1,298,432 SLOTS REMAINING</span>
					</div>
					<a href="/signin" class="cta-ink aven-plot-cta" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">PLAY NOW</a>
				</div>
			</section>

			<div class="crowd-pointillism"></div>
		</main>
	`
}
