/**
 * Landing Page – Maia City: The Game
 * Radical Solarpunk Manifesto Canvas
 */

/** Financing milestone cap (citizen campaign): Fibonacci F(31) — single source for copy and €1 math. */
const CITIZEN_FINANCING_MILESTONE = 1_346_269

export function renderLandingPage() {
	const C = CITIZEN_FINANCING_MILESTONE
	const citizensFmt = C.toLocaleString('en-US')
	const citizensCompactM = `${(C / 1_000_000).toFixed(2)}M`
	const euroPool = C * 365 * 16
	const euroPoolFormatted = euroPool.toLocaleString('en-US')
	const euroBillionsApprox = (euroPool / 1_000_000_000).toFixed(2)

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
						<a href="/signin" class="nav-play-btn" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">Sign in</a>
					</div>
				</div>
			</nav>
			
			<section class="manifesto-beat beat-provocation magazine-layout">
				<div class="pain-headline-container">
					<img src="/brand/images/hero.png" alt="" class="pain-bg-img" />
					<h1 class="huge-type pain-headline glass-card">
						<span class="pain-main">How will we pay rent?</span><br/>
						<span class="pain-sub">once AGI is faster, cheaper and better at our jobs?</span>
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
							<span class="wow-sub">zero human labor, local permaculture food production,<br/>100% autonomous underground transportation.</span>
						</h2>
					</div>
					<div class="blueprint-intro">
						<p class="manifesto-body">
							The current monetary economy breaks apart the moment AGI is faster, cheaper, and better at every human task: wages collapse and purchasing power disappears — there is no one left to consume what the old system still tries to sell. That system no longer serves us. We need a new one.
						</p>
						<p class="manifesto-body">
							Maia City is Earth's new capital — where we prove that the future of our civilisation will be organized around a new primitive. A new breed of sovereign cities that are 100% owned by their human citizens and operated by Avens (Agentic AGI).
						</p>
						<p class="manifesto-body">
							First we build Maia City as a game simulation, where ${citizensFmt} humans collaborate to design a 10x better way of living. But we aren't just playing a game; we are engineering a proven blueprint for the real world.
						</p>
					</div>

					<section class="beat-euro-power" aria-label="Collective capital">
						<p class="euro-power-eyebrow">The power of €1</p>
						<h2 class="euro-power-headline">
							When ${citizensFmt} humans unite to build the better system of tomorrow, €1 per citizen per day is not spare change — over the arc to 2042 it is a multi-billion-euro pool for foundational infrastructure and AI startups that make the real Maia City possible.
						</h2>
						<div class="euro-math-board" role="group" aria-label="€1 per day times ${citizensFmt} citizens times 365 days times 16 years">
							<div class="euro-math-row euro-math-row--inputs">
								<div class="euro-math-cell">
									<span class="euro-math-figure">€1</span>
									<span class="euro-math-desc">per citizen / day</span>
								</div>
								<span class="euro-math-times" aria-hidden="true">×</span>
								<div class="euro-math-cell">
									<span class="euro-math-figure">${citizensCompactM}</span>
									<span class="euro-math-desc">citizens</span>
								</div>
								<span class="euro-math-times" aria-hidden="true">×</span>
								<div class="euro-math-cell">
									<span class="euro-math-figure">365</span>
									<span class="euro-math-desc">days / year</span>
								</div>
								<span class="euro-math-times" aria-hidden="true">×</span>
								<div class="euro-math-cell">
									<span class="euro-math-figure">16</span>
									<span class="euro-math-desc">years (→ 2042)</span>
								</div>
							</div>
							<div class="euro-math-equals" aria-hidden="true"></div>
							<p class="euro-math-result">
								<span class="euro-math-result-label">€1 × ${citizensFmt} × 365 × 16 (illustrative, no interest)</span>
								<span class="euro-math-result-number">≈ €${euroBillionsApprox} billion</span>
								<span class="euro-math-result-exact" aria-label="Exact product">${citizensFmt} × 365 × 16 = €${euroPoolFormatted}</span>
							</p>
						</div>
						<p class="euro-power-body">
							That is the order of magnitude we can steer into <strong>ground-up infrastructure</strong> and <strong>foundational AI startups</strong> — the stack the physical city needs before the first permit. <strong>Owned and controlled by its future citizens</strong>, not distant shareholders: capital that follows the people building the place they will live in.
						</p>
					</section>

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
										We believe when ${citizensFmt} humans unite in vision, we can actually build Maia City hand in hand with AGI-Agents.<br/>
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
					<div class="evolution-step step-phase-sim">
						<div class="step-marker">
							<span class="step-number">01</span>
							<span class="step-date">2026-27</span>
						</div>
						<div class="step-content">
							<h3>The Simulation Game</h3>
							<p>We collectively architect the future of urban living from the ground up. In this SimCity-style economy simulation, we stress-test radical currency models and cooperative organizational forms. It’s a shared sandbox where ${citizensFmt} humans prove the blueprint for a post-labor world before we ever break ground.</p>
						</div>
					</div>

					<div class="evolution-step step-phase-avens">
						<div class="step-marker">
							<span class="step-number">02</span>
							<span class="step-date">2027-28</span>
						</div>
						<div class="step-content">
							<h3>Avens (AGI-Agents) Rising</h3>
							<p>The transition from human play to agentic execution. Once we reach ${citizensFmt} virtual citizens, the top 250 coop-founders from the leaderboard receive a €120k angel grant to build their AI startups. Together, we co-live in a prototype coworking village in Europe—a community hacker space dedicated to engineering the foundational infrastructure startups required to build the real city from scratch.</p>
						</div>
					</div>

					<div class="evolution-step step-phase-unity">
						<div class="step-marker">
							<span class="step-number">03</span>
							<span class="step-date">2028-42</span>
						</div>
						<div class="step-content">
							<h3>The Unity</h3>
							<p>The real city evolves. Every month, the top AI startup is awarded a €15 million seed investment to build one foundational cornerstone brick of the physical city. Simultaneously, another €15 million per month is dedicated to the purchase of the future land—turning the simulation’s proven blueprint into a sovereign physical reality where humans and Avens unite.</p>
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
							Hi, I am <strong>Aven Maia</strong>, the first agentic Co-Founder and Mayor of Maia City. Together with you and ${citizensFmt} citizens, I am here to help you build our city from the ground up. First we learn &ldquo;in game&rdquo;, then we build it for real.
						</p>
						<p class="aven-letter-emphasis">I call the visionary in you.</p>
						<p class="aven-letter-short">The virtual land is empty. The rules are unwritten.</p>
						<p class="aven-letter-close">
							We are calling the founders, the architects, and the entrepreneurs with fire in their belly. Become one of the first future citizens to unite in purpose and orchestrate the first economy designed for human flourishing.
						</p>
					</div>
				</div>
			</section>

			<section class="manifesto-beat beat-plot-cta" aria-label="Invite-only waitlist">
				<div class="aven-plot-panel aven-plot-panel--standalone" role="group" aria-label="Invite-only waitlist">
					<div class="aven-plot-headlines">
						<span class="aven-plot-title">Maia City is exclusively invite-only</span>
						<span class="aven-plot-sub">Get on the waitlist for your personal invite as one of the first future citizens.</span>
					</div>
					<a href="/signin" class="cta-ink aven-plot-cta" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">Get on the waitlist</a>
				</div>
			</section>

			<div class="crowd-pointillism"></div>
		</main>
	`
}
