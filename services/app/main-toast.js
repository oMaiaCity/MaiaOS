const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ' }
const TOAST_TITLES = { success: 'Success', error: 'Authentication Failed', info: 'Info' }

/** Show toast notification. type: 'success'|'error'|'info', duration in ms (default 5000) */
export function showToast(message, type = 'info', duration = 5000) {
	const toast = document.createElement('div')
	toast.className = `toast ${type}`
	toast.innerHTML = `
		<div class="toast-content">
			<div class="toast-icon">${TOAST_ICONS[type]}</div>
			<div class="toast-message">
				<div class="toast-title">${TOAST_TITLES[type]}</div>
				${message}
			</div>
		</div>
	`
	document.body.appendChild(toast)
	setTimeout(() => {
		toast.classList.add('removing')
		setTimeout(() => document.body.removeChild(toast), 300)
	}, duration)
}
