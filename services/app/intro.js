/**
 * /intro — onboarding copy + name capture
 */

/** Date line in the diary (written from 2042). */
const DIARY_TODAY = '21 of March 2042'

/** One line each; two distinct lines are picked at random after the opening pair. */
const DIARY_TAIL_POOL = [
	'From up here I can still see the day we drew the first faint line on the map.',
	'The dome was only paper once; now it holds a neighborhood of glass and garden.',
	'We raise a quiet glass to you — the one who typed a name and walked through.',
	'The river remembers everyone who chose courage; the ledger still spells yours.',
	'Time bent toward this morning more than we admitted when we were young.',
	"The spiral stairs still squeak where you said: we'll build it together.",
	'I reread your old note whenever the city feels too finished.',
	'Back then we called it a prototype; today we call it home.',
	'The mesh hums a little warmer when your thread hits the weave.',
	'Some days I pretend 2026 is just downstairs, one long breath away.',
]

function shuffleCopy(arr) {
	const out = [...arr]
	for (let i = out.length - 1; i > 0; i--) {
		const j = (Math.random() * (i + 1)) | 0
		const t = out[i]
		out[i] = out[j]
		out[j] = t
	}
	return out
}

function typewriterInto(el, text, msPerChar) {
	return new Promise((resolve) => {
		el.textContent = ''
		let i = 0
		const tick = () => {
			if (i >= text.length) {
				resolve()
				return
			}
			el.textContent += text[i]
			i++
			setTimeout(tick, msPerChar)
		}
		tick()
	})
}

function pauseMs(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

/**
 * Replace the intro form with a short diary entry, letter-by-letter, then reveal Continue → /signin.
 * Copy is self-addressed; the form name is only stored for sign-in (see main.js).
 */
export async function beginIntroDiary() {
	const center = document.querySelector('.intro-center')
	if (!center) return

	const [lineA, lineB] = shuffleCopy(DIARY_TAIL_POOL)
	const lines = ['Good morning my self,', `today is ${DIARY_TODAY}.`, lineA, lineB]

	const msPerChar = 52
	const pauseBetweenLinesMs = 520

	center.innerHTML = `
		<div class="intro-diary" aria-live="polite">
			<p class="intro-diary-line" id="intro-diary-0"></p>
			<p class="intro-diary-line" id="intro-diary-1"></p>
			<p class="intro-diary-line" id="intro-diary-2"></p>
			<p class="intro-diary-line" id="intro-diary-3"></p>
		</div>
		<div class="intro-diary-actions" hidden>
			<button type="button" class="hero-cta-btn intro-submit" data-maia-action="navigateTo" data-path="/signin">Continue</button>
		</div>
	`

	const els = lines.map((_, i) => document.getElementById(`intro-diary-${i}`))

	for (let i = 0; i < lines.length; i++) {
		const lineEl = els[i]
		if (!lineEl) break
		await typewriterInto(lineEl, lines[i], msPerChar)
		if (i < lines.length - 1) await pauseMs(pauseBetweenLinesMs)
	}

	const actions = center.querySelector('.intro-diary-actions')
	if (actions) actions.hidden = false
}

export function renderIntroPage() {
	document.getElementById('app').innerHTML = `
		<main class="manifesto-canvas intro-page">
			<div class="blueprint-lines" aria-hidden="true"></div>
			<div class="intro-center">
				<form class="intro-form" id="intro-form" action="/signin" method="get">
					<h1 class="intro-headline-stack">
						<span class="intro-headline-title">Let's look into your future</span>
						<span class="intro-headline-sub">How may we call you?</span>
					</h1>
					<div class="intro-field">
						<input
							type="text"
							id="intro-name"
							name="name"
							class="intro-input"
							placeholder="my first name is"
							autocomplete="given-name"
							aria-label="Your first name"
							enterkeyhint="done"
						/>
					</div>
					<button type="submit" class="hero-cta-btn intro-submit">Start journey</button>
				</form>
			</div>
			<div class="crowd-pointillism" aria-hidden="true"></div>
		</main>
	`
}
