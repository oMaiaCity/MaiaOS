<script>
/**
 * TextWrap - Wrapper component for text content with consistent styling
 * Used for legal pages, documentation, etc.
 */

const { children, class: className = '', ...restProps } = $props()
</script>

<div class="text-wrap-container">
	<div class="text-wrap-content {className}" {...restProps}>
		{@render children()}
	</div>
</div>

<style>
	.text-wrap-container {
		min-height: 100vh;
		background: #fefdfb;
		padding: 4rem 1.5rem;
		display: flex;
		justify-content: center;
	}

	.text-wrap-content {
		max-width: 800px;
		width: 100%;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	:global(.text-wrap-content a) {
		color: #3b82f6;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.2s;
	}

	:global(.text-wrap-content a:hover) {
		color: #2563eb;
	}

	:global(.text-wrap-content h1) {
		font-size: 2.5rem;
		font-weight: 500;
		margin-top: 0;
		margin-bottom: 2rem;
		line-height: 1.3;
		color: var(--color-primary-800, #001a42); /* Primary 800 for titles */
	}

	:global(.text-wrap-content h2) {
		font-size: 1.75rem;
		font-weight: 500;
		margin-top: 3rem;
		margin-bottom: 1rem;
		line-height: 1.3;
		color: var(--color-primary-800, #001a42); /* Primary 800 for titles */
	}

	:global(.text-wrap-content h3) {
		font-size: 1.4rem;
		font-weight: 500;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
		line-height: 1.3;
		color: var(--color-primary-800, #001a42); /* Primary 800 for titles */
	}

	:global(.text-wrap-content h4) {
		font-size: 1.2rem;
		font-weight: 500;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
		line-height: 1.3;
		color: var(--color-primary-800, #001a42); /* Primary 800 for titles */
	}

	:global(.text-wrap-content h5) {
		font-size: 1.1rem;
		font-weight: 500;
		margin-top: 1.3rem;
		margin-bottom: 0.5rem;
		line-height: 1.3;
		color: var(--color-primary-800, #001a42); /* Primary 800 for titles */
	}

	:global(.text-wrap-content p) {
		font-size: 1rem;
		line-height: 1.7;
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #4b5563;
	}

	:global(.text-wrap-content p:last-child) {
		margin-bottom: 0;
	}

	:global(.text-wrap-content ul) {
		margin-top: 0;
		margin-bottom: 1.5rem;
		padding-left: 1.5rem;
	}

	:global(.text-wrap-content ul:last-child) {
		margin-bottom: 0;
	}

	:global(.text-wrap-content li) {
		font-size: 1rem;
		line-height: 1.7;
		margin-bottom: 0.75rem;
		color: #4b5563;
	}

	:global(.text-wrap-content li:last-child) {
		margin-bottom: 0;
	}

	:global(.text-wrap-content strong) {
		font-weight: 600;
		color: #111827;
	}

	@media (max-width: 768px) {
		.text-wrap-container {
			padding: 2rem 1rem;
		}

		:global(.text-wrap-content h1) {
			font-size: 2rem;
			margin-bottom: 1.5rem;
		}

		:global(.text-wrap-content h2) {
			font-size: 1.5rem;
			margin-top: 2.5rem;
			margin-bottom: 0.875rem;
		}

		:global(.text-wrap-content h3) {
			font-size: 1.25rem;
			margin-top: 1.75rem;
			margin-bottom: 0.625rem;
		}

		:global(.text-wrap-content h4),
		:global(.text-wrap-content h5) {
			font-size: 1.1rem;
			margin-top: 1.5rem;
			margin-bottom: 0.5rem;
		}

		:global(.text-wrap-content p) {
			font-size: 0.938rem;
			margin-bottom: 1.25rem;
		}

		:global(.text-wrap-content li) {
			font-size: 0.938rem;
			margin-bottom: 0.625rem;
		}
	}
</style>

