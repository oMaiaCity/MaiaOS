<script>
	// Random Unsplash image - you can change this URL to any Unsplash image
	const bgImage = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80';
</script>

<div class="coming-soon-container">
	<div class="background-image" style="background-image: url('{bgImage}')"></div>
	
	<div class="content-wrapper">
		<div class="glass-card">
			<h1 class="title">Coming Soon</h1>
			<p class="subtitle">Something amazing is on the way</p>
			<div class="divider"></div>
			<p class="description">We're working hard to bring you an incredible experience. Stay tuned!</p>
		</div>
	</div>
</div>

<style>
	.coming-soon-container {
		position: fixed;
		/* Extend behind safe areas (notch, bottom bar) */
		top: calc(0px - env(safe-area-inset-top));
		left: calc(0px - env(safe-area-inset-left));
		right: calc(0px - env(safe-area-inset-right));
		bottom: calc(0px - env(safe-area-inset-bottom));
		width: auto;
		height: auto;
		overflow: hidden;
	}

	.background-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		z-index: 0;
	}

	.background-image::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(0px);
	}

	.content-wrapper {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Add safe area padding so content doesn't go behind notch/bottom */
		padding-top: calc(2rem + env(safe-area-inset-top));
		padding-right: calc(2rem + env(safe-area-inset-right));
		padding-bottom: calc(2rem + env(safe-area-inset-bottom));
		padding-left: calc(2rem + env(safe-area-inset-left));
	}

	.glass-card {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		border-radius: 24px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 4rem 3rem;
		text-align: center;
		box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
		max-width: 600px;
		width: 100%;
		animation: fadeInUp 0.8s ease-out;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.title {
		font-size: 4rem;
		font-weight: 700;
		color: white;
		margin: 0 0 1rem 0;
		text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.9);
		margin: 0 0 2rem 0;
		font-weight: 300;
	}

	.divider {
		width: 80px;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
		margin: 0 auto 2rem;
	}

	.description {
		font-size: 1.1rem;
		color: rgba(255, 255, 255, 0.8);
		line-height: 1.6;
		margin: 0;
	}

	@media (max-width: 768px) {
		.glass-card {
			padding: 3rem 2rem;
		}

		.title {
			font-size: 2.5rem;
		}

		.subtitle {
			font-size: 1.2rem;
		}

		.description {
			font-size: 1rem;
		}
	}
</style>
