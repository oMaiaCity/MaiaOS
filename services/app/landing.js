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
						<a href="/docs" class="nav-link" data-maia-action="navigateTo" data-path="/docs">Docs</a>
						<a href="/blog" class="nav-link" data-maia-action="navigateTo" data-path="/blog">Blog</a>
					</div>
					<div class="landing-nav-center">
						<img src="/brand/logo_dark.svg" alt="Maia City" class="nav-logo" data-maia-action="navigateTo" data-path="/" />
					</div>
					<div class="landing-nav-right">
						<a href="/signin" class="nav-play-btn" data-maia-action="navigateTo" data-path="/signin">Sign in</a>
					</div>
				</div>
			</nav>
			
			<section class="manifesto-beat beat-provocation magazine-layout">
				<div class="magazine-story">
					<p class="hero-pain">
						<span class="pain-resolution">
							<span class="res-preface">You can feel it</span>
							<span class="breaking-free">
								<span class="res-break">The <strong class="res-break-old">old</strong> world is breaking</span>
							</span>
							<span class="res-hope">AND it's the best thing that is happening to us.</span>
						</span>
					</p>
					<div class="hero-cta">
						<p class="hero-cta-lead">Ready to build the new world?</p>
						<a href="/signin" class="hero-cta-btn" data-maia-action="navigateTo" data-path="/signin">Yes</a>
					</div>
				</div>
			</section>

			<div class="crowd-pointillism"></div>
		</main>
	`
}
