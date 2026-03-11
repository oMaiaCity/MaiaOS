/**
 * Landing Page – Coming Soon
 */

export function renderLandingPage() {
	document.getElementById('app').innerHTML = `
		<main class="landing-coming-soon">
			<div class="landing-coming-card liquid-glass">
				<div class="liquid-glass--bend"></div>
				<div class="liquid-glass--face"></div>
				<div class="liquid-glass--edge"></div>
				<div class="landing-coming-content liquid-glass-inner">
					<img src="/brand/logo.svg" alt="Maia" class="landing-coming-logo" />
					<h1 class="landing-coming-title">Coming Soon</h1>
					<p class="landing-coming-slogan">where vision is reality</p>
					<a href="/signin" class="landing-coming-link" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">Sign in</a>
				</div>
			</div>
		</main>
	`
}
