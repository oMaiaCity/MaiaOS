/**
 * Landing Page Rendering
 * Displays the MaiaCity landing page with hero section and story
 */

export function renderLandingPage() {
	document.getElementById("app").innerHTML = `
		<main class="container landing-main" style="overflow-x: hidden; box-sizing: border-box;">
			<!-- THE MASTER HOOK -->
			<section class="hero" style="
				min-height: 92vh;
				display: flex;
				flex-direction: column;
				justify-content: center;
				padding-top: 0;
				margin-top: 0;
				position: relative;
			">
				<!-- Banner Text -->
				<div style="
					margin-bottom: 2rem;
					font-family: var(--font-body);
					font-size: clamp(1.2rem, 3vw, 1.8rem);
					line-height: 1.6;
					font-weight: 500;
					letter-spacing: 0.02em;
					text-align: center;
					color: var(--color-tinted-white);
					text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
				">
					We were never meant to live small.
				</div>

				<!-- Main Headline -->
				<h1 style="font-size: clamp(2.5rem, 6vw, 4.5rem); margin-bottom: 0; text-align: center; line-height: 1.2;">
					MaiaCity is the place where<br>
					<span style="
						display: inline-block;
						padding: 0.2rem 1.2rem;
						background: rgba(0, 189, 214, 0.25);
						backdrop-filter: blur(8px);
						border-radius: 8px;
						margin-top: 0.5rem;
						border: 1px solid rgba(0, 189, 214, 0.3);
						box-shadow: 0 0 30px rgba(0, 189, 214, 0.2);
					"><em>humans true potential</em></span> comes to life.
				</h1>

				<!-- Story Opener - Positioned at bottom of hero -->
				<div class="landing-story-opener" style="
					position: absolute;
					bottom: 10%;
					left: 50%;
					transform: translateX(-50%);
					font-family: var(--font-body);
					font-size: clamp(0.75rem, 1.5vw, 0.85rem);
					color: var(--color-marine-blue);
					letter-spacing: 0.3em;
					text-transform: uppercase;
					font-weight: 800;
					padding: 0.5rem 2rem;
					background: var(--color-soft-clay);
					border-radius: 50px;
					box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
					z-index: 10;
				">This is the story of</div>
			</section>

			<!-- THE STORY SECTION -->
			<section class="landing-story" style="
				margin-top: 0;
				padding-top: 2rem;
				display: grid;
				grid-template-columns: repeat(12, 1fr);
				gap: 1.5rem;
				max-width: 1100px;
				width: 100%;
				box-sizing: border-box;
				padding-left: 1rem;
				padding-right: 1rem;
				margin-left: auto;
				margin-right: auto;
				align-items: center;
			">
				<!-- Chunk 1: Who -->
				<div class="landing-chunk landing-chunk-1" style="
					grid-column: 2 / span 7;
					justify-self: start;
					max-width: 100%;
					font-family: var(--font-heading);
					font-style: italic;
					font-size: clamp(1.6rem, 4vw, 2.8rem);
					line-height: 1.3;
					padding: 2rem;
					background: rgba(255, 255, 255, 0.12);
					backdrop-filter: blur(20px) saturate(160%);
					border-radius: 24px;
					border: 1px solid rgba(255, 255, 255, 0.25);
					color: var(--color-tinted-white);
					text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
					transform: rotate(-1deg);
					margin-left: 1rem;
				">
					how <strong style="color: var(--color-terracotta); text-shadow: 0 0 20px rgba(194, 123, 102, 0.4);">1.3 million</strong> maia citizens
				</div>

				<!-- Chunk 2: What -->
				<div class="landing-chunk landing-chunk-2" style="
					grid-column: 4 / -1;
					justify-self: end;
					max-width: 100%;
					font-family: var(--font-heading);
					font-style: italic;
					font-size: clamp(1.6rem, 4vw, 2.8rem);
					line-height: 1.3;
					padding: 2rem;
					background: rgba(255, 255, 255, 0.18);
					backdrop-filter: blur(25px) saturate(180%);
					border-radius: 24px;
					border: 1px solid rgba(255, 255, 255, 0.35);
					color: var(--color-tinted-white);
					text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
					margin-top: -1rem;
					z-index: 2;
					transform: rotate(1deg);
					margin-right: 1rem;
				">
					<strong style="color: var(--color-sun-yellow); font-weight: 700; text-shadow: 0 0 30px rgba(230, 185, 77, 0.5);">craft</strong> from the ground up
				</div>

				<!-- Chunk 3: Timeline -->
				<div class="landing-chunk landing-chunk-3" style="
					grid-column: 1 / -1;
					justify-self: center;
					font-family: var(--font-heading);
					font-style: italic;
					font-size: clamp(1.4rem, 3.2vw, 2.2rem);
					line-height: 1.3;
					padding: 1.5rem 3rem;
					background: rgba(255, 255, 255, 0.15);
					backdrop-filter: blur(20px) saturate(160%);
					border-radius: 24px;
					border: 1px solid rgba(255, 255, 255, 0.25);
					color: var(--color-tinted-white);
					text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
					z-index: 1;
					margin-top: -0.5rem;
				">
					in less than <strong style="color: var(--color-paradise-water); text-shadow: 0 0 20px rgba(0, 189, 214, 0.5);">16 years</strong>
				</div>

				<!-- LOGO STANDALONE -->
				<div class="landing-logo" style="grid-column: 1 / -1; justify-self: center; margin: 3rem 0;">
					<img src="/brand/logo.svg" alt="MaiaCity Logo" style="height: clamp(8rem, 18vw, 14rem); filter: drop-shadow(0 0 50px rgba(0, 189, 214, 0.7));" />
				</div>

				<!-- Chunk 4: Why -->
				<div class="landing-chunk landing-chunk-4" style="
					grid-column: 2 / 12;
					font-family: var(--font-heading);
					font-style: italic;
					font-size: clamp(1.2rem, 3vw, 2rem);
					line-height: 1.5;
					text-align: center;
					padding: 3rem 2.5rem;
					background: rgba(0, 31, 51, 0.4);
					backdrop-filter: blur(15px);
					border-radius: 30px;
					border: 1px solid rgba(0, 189, 214, 0.3);
					color: var(--color-tinted-white);
					margin-top: 0;
					position: relative;
				">
					<span>Earth's new capital, where <strong style="color: var(--color-paradise-water); font-weight: 700; text-shadow: 0 0 20px rgba(0, 189, 214, 0.6);">civilization-shaping</strong> visions become reality at <strong style="color: var(--color-lush-green); font-weight: 700; text-shadow: 0 0 20px rgba(78, 154, 88, 0.6);">100x growth</strong></span>
				</div>

				<!-- CTA Button Area -->
				<div style="grid-column: 1 / -1; justify-self: center; margin-top: 4rem; margin-bottom: 8rem; display: flex; flex-direction: column; align-items: center; gap: 1.2rem;">
					<div style="
						font-family: var(--font-body);
						color: var(--color-tinted-white);
						letter-spacing: 0.15em;
						text-transform: uppercase;
						font-weight: 800;
						text-shadow: 0 0 30px rgba(232, 225, 217, 0.4);
						text-align: center;
						display: flex;
						flex-direction: column;
						gap: 0.4rem;
					">
						<span style="font-size: clamp(1.2rem, 2.5vw, 1.8rem);">Reclaim your sovereignty</span>
						<span style="color: var(--color-tinted-white); font-size: 1.2em; font-family: var(--font-heading); font-style: italic; opacity: 0.9;">&</span>
						<span style="font-size: clamp(0.9rem, 1.8vw, 1.3rem); opacity: 0.9;">become a maia citizen</span>
					</div>
					<button class="btn" style="
						background: rgba(78, 154, 88, 0.8);
						color: #F0EDE6;
						font-size: 1.2rem; 
						padding: 1.2rem 5rem; 
						letter-spacing: 0.15em; 
						box-shadow: 0 0 40px rgba(78, 154, 88, 0.4);
						border: 1px solid rgba(255, 255, 255, 0.2);
						backdrop-filter: blur(8px);
					" onclick="event.preventDefault(); window.navigateTo('/signin'); return false;">JOIN NOW</button>
				</div>
			</section>
		</main>
	`;
}
