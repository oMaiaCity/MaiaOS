/**
 * Landing Page – hero section and story
 */

export function renderLandingPage() {
	document.getElementById('app').innerHTML = `
		<main class="container landing-main">
			<section class="hero">
				<div class="landing-banner">We were never meant to live small.</div>
				<h1 class="landing-headline">
					MaiaCity is the place where<br>
					<span><em>humans true potential</em></span> comes to life.
				</h1>
				<div class="landing-story-opener">This is the story of</div>
			</section>
			<section class="landing-story">
				<div class="landing-chunk landing-chunk-1">
					how <strong class="terracotta">1.3 million</strong> maia citizens
				</div>
				<div class="landing-chunk landing-chunk-2">
					<strong class="sun-yellow">craft</strong> from the ground up
				</div>
				<div class="landing-chunk landing-chunk-3">
					in less than <strong class="paradise-water">16 years</strong>
				</div>
				<div class="landing-logo">
					<img src="/brand/logo.svg" alt="MaiaCity Logo" />
				</div>
				<div class="landing-chunk landing-chunk-4">
					<span>Earth's new capital, where <strong class="paradise-water-bright">civilization-shaping</strong> visions become reality at <strong class="lush-green">100x growth</strong></span>
				</div>
				<div class="landing-cta">
					<div class="landing-cta-text">
						<span class="lead">Reclaim your sovereignty</span>
						<span class="amp">&</span>
						<span class="sub">become a maia citizen</span>
					</div>
					<button class="btn" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">JOIN NOW</button>
				</div>
			</section>
		</main>
	`
}
