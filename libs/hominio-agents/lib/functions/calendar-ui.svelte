<!--
	Calendar UI Component
	Displays calendar entries in a week view (today + next 6 days)
	Top-to-bottom list with glass card styling
-->
<script>
	import { GlassCard } from '@hominio/brand';
	import { calendarEntries } from './calendar-store.js';
	
	let { data, onClose } = $props();
	
	// Get entries from data or store
	const entries = $derived(data?.entries || []);
	const entriesByDate = $derived(data?.entriesByDate || {});
	const weekStart = $derived(data?.weekStart);
	const weekEnd = $derived(data?.weekEnd);
	
	// Helper to parse YYYY-MM-DD as local date (midnight)
	function parseLocalYMD(dateStr) {
		if (!dateStr) return new Date();
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	// Helper to check if two dates are the same day
	function isSameDay(d1, d2) {
		return d1.getFullYear() === d2.getFullYear() &&
			   d1.getMonth() === d2.getMonth() &&
			   d1.getDate() === d2.getDate();
	}

	// Generate week dates (today + next 6 days)
	const weekDates = $derived.by(() => {
		const dates = [];
		// Use parseLocalYMD to avoid timezone shifts when parsing server date strings
		const start = weekStart ? parseLocalYMD(weekStart) : new Date();
		start.setHours(0, 0, 0, 0);
		
		const today = new Date();
		
		for (let i = 0; i < 7; i++) {
			const date = new Date(start);
			date.setDate(date.getDate() + i);
			
			// Generate local YYYY-MM-DD string to match server keys
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const dateStr = `${year}-${month}-${day}`;
			
			dates.push({
				date: dateStr,
				dateObj: date,
				isToday: isSameDay(date, today)
			});
		}
		return dates;
	});
	
	function formatDate(dateObj) {
		const today = new Date();
		const date = new Date(dateObj);
		
		if (isSameDay(date, today)) {
			return 'Heute';
		}
		
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (isSameDay(date, tomorrow)) {
			return 'Morgen';
		}
		
		return date.toLocaleDateString('de-DE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}
	
	function formatTime(time) {
		return time; // Already in HH:MM format
	}
	
	function calculateEndTime(startTime, duration) {
		const [hours, minutes] = startTime.split(':').map(Number);
		const startMinutes = hours * 60 + minutes;
		const endMinutes = startMinutes + duration;
		const endHours = Math.floor(endMinutes / 60) % 24;
		const endMins = endMinutes % 60;
		return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
	}
	
	function formatDuration(duration) {
		if (duration < 60) {
			return `${duration} Min`;
		}
		const hours = Math.floor(duration / 60);
		const minutes = duration % 60;
		if (minutes === 0) {
			return `${hours} ${hours === 1 ? 'Std' : 'Std'}`;
		}
		return `${hours} ${hours === 1 ? 'Std' : 'Std'} ${minutes} Min`;
	}
</script>

<div class="calendar-week-view">
	<!-- Header -->
	<div class="calendar-header">
		<h2 class="calendar-title">Dein Kalender</h2>
		{#if weekStart && weekEnd}
			<p class="calendar-subtitle">
				{new Date(weekStart).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} - 
				{new Date(weekEnd).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
			</p>
		{/if}
	</div>
	
	<!-- Week View: Top to Bottom List -->
	<div class="calendar-days-list">
		{#each weekDates as { date, dateObj, isToday } (date)}
			{@const dayEntries = entriesByDate[date] || []}
			<div class="calendar-day {isToday ? 'is-today' : ''}">
				<!-- Day Header -->
				<div class="day-header">
					<h3 class="day-title">
						{formatDate(dateObj)}
						{#if isToday}
							<span class="today-badge">HEUTE</span>
						{/if}
					</h3>
					{#if dayEntries.length > 0}
						<span class="day-entry-count">
							{dayEntries.length} {dayEntries.length === 1 ? 'Termin' : 'Termine'}
						</span>
					{/if}
				</div>
				
				<!-- Day Entries -->
				{#if dayEntries.length > 0}
					<div class="day-entries">
						{#each dayEntries as entry (entry.id)}
							<GlassCard class="calendar-entry-card">
								<div class="entry-content">
									<div class="entry-time-column">
										<span class="time-start">{formatTime(entry.time)}</span>
										<div class="time-divider"></div>
										<span class="time-end">{calculateEndTime(entry.time, entry.duration)}</span>
									</div>
									
									<div class="entry-details">
										<h4 class="entry-title">{entry.title}</h4>
										
										<div class="entry-meta-row">
											<span class="duration-badge">
												<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<circle cx="12" cy="12" r="10"></circle>
													<polyline points="12 6 12 12 16 14"></polyline>
												</svg>
												{formatDuration(entry.duration)}
											</span>
										</div>
										
										{#if entry.description}
											<p class="entry-description">{entry.description}</p>
										{/if}
									</div>
								</div>
							</GlassCard>
						{/each}
					</div>
				{:else}
					<div class="day-empty">
						<span class="empty-dot"></span>
						<p class="empty-text">Keine Termine</p>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	
	<!-- Empty State (if no entries at all) -->
	{#if entries.length === 0}
		<div class="calendar-empty-state">
			<GlassCard class="empty-card">
				<div class="empty-content">
					<div class="empty-icon-wrapper">
						<svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<h3 class="empty-title">Keine Termine vorhanden</h3>
					<p class="empty-description">Erstelle einen neuen Termin, um zu beginnen.</p>
				</div>
			</GlassCard>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		--calendar-primary: var(--color-secondary-500); /* Secondary brand color (teal) */
		--calendar-primary-soft: rgba(45, 166, 180, 0.1); /* Secondary-500 with opacity */
		--calendar-text: #1e293b;
		--calendar-text-light: #64748b;
	}

	.calendar-week-view {
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
		font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	}
	
	.calendar-header {
		margin-bottom: 2.5rem;
		text-align: center;
	}
	
	.calendar-title {
		font-size: 2rem;
		font-weight: 800;
		background: linear-gradient(135deg, var(--color-secondary-400) 0%, var(--color-secondary-500) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		margin-bottom: 0.5rem;
		letter-spacing: -0.02em;
	}
	
	.calendar-subtitle {
		font-size: 0.95rem;
		color: var(--calendar-text-light);
		margin: 0;
		font-weight: 500;
	}
	
	.calendar-days-list {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}
	
	.calendar-day {
		width: 100%;
		position: relative;
	}
	
	.calendar-day.is-today .day-title {
		color: var(--calendar-primary);
	}
	
	.day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		padding-left: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}
	
	.day-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--calendar-text);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	
	.today-badge {
		font-size: 0.7rem;
		background: var(--calendar-primary);
		color: white;
		padding: 0.15rem 0.5rem;
		border-radius: 99px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	
	.day-entry-count {
		font-size: 0.85rem;
		color: var(--calendar-text-light);
		font-weight: 500;
		background: rgba(241, 245, 249, 0.5);
		padding: 0.25rem 0.75rem;
		border-radius: 99px;
	}
	
	.day-entries {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	/* Glass Card Styling */
	:global(.calendar-entry-card) {
		padding: 0 !important; /* We handle padding internally */
		border: 1px solid rgba(255, 255, 255, 0.4) !important;
		background: rgba(255, 255, 255, 0.6) !important;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03) !important;
		border-radius: 1rem !important;
		overflow: hidden;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
	}
	
	:global(.calendar-entry-card:hover) {
		transform: translateY(-2px) scale(1.01);
		background: rgba(255, 255, 255, 0.8) !important;
		box-shadow: 0 12px 30px rgba(45, 166, 180, 0.1) !important; /* Secondary-500 with opacity */
		border-color: rgba(45, 166, 180, 0.3) !important; /* Secondary-500 with opacity */
	}
	
	.entry-content {
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}
	
	/* Time Column */
	.entry-time-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1.25rem;
		background: rgba(45, 166, 180, 0.03); /* Secondary-500 with opacity */
		border-right: 1px solid rgba(45, 166, 180, 0.08); /* Secondary-500 with opacity */
		min-width: 90px;
	}
	
	.time-start {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--calendar-text);
		line-height: 1;
	}
	
	.time-divider {
		width: 2px;
		height: 12px;
		background: var(--calendar-primary);
		opacity: 0.3;
		margin: 0.4rem 0;
		border-radius: 2px;
	}
	
	.time-end {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--calendar-text-light);
	}
	
	/* Details Column */
	.entry-details {
		flex: 1;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	
	.entry-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--calendar-text);
		margin: 0 0 0.5rem 0;
		line-height: 1.3;
	}
	
	.entry-meta-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}
	
	.duration-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--calendar-primary);
		background: var(--calendar-primary-soft);
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		font-weight: 600;
	}
	
	.icon {
		width: 12px;
		height: 12px;
	}
	
	.entry-description {
		font-size: 0.9rem;
		color: var(--calendar-text-light);
		line-height: 1.5;
		margin: 0.25rem 0 0 0;
	}
	
	/* Empty States */
	.day-empty {
		padding: 1.5rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		opacity: 0.5;
	}
	
	.empty-dot {
		width: 6px;
		height: 6px;
		background: #cbd5e1;
		border-radius: 50%;
	}
	
	.empty-text {
		font-size: 0.9rem;
		color: #94a3b8;
		margin: 0;
		font-style: italic;
	}
	
	.calendar-empty-state {
		margin-top: 4rem;
		display: flex;
		justify-content: center;
	}
	
	.empty-card {
		padding: 3rem 2rem;
		max-width: 400px;
		text-align: center;
	}
	
	.empty-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}
	
	.empty-icon-wrapper {
		width: 5rem;
		height: 5rem;
		background: var(--calendar-primary-soft);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
	}
	
	.empty-icon {
		width: 2.5rem;
		height: 2.5rem;
		color: var(--calendar-primary);
	}
	
	.empty-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--calendar-text);
		margin: 0;
	}
	
	.empty-description {
		font-size: 0.95rem;
		color: var(--calendar-text-light);
		margin: 0;
		line-height: 1.5;
	}
	
	/* Mobile Responsive */
	@media (max-width: 640px) {
		.calendar-week-view {
			padding: 0.75rem;
		}
		
		.calendar-title {
			font-size: 1.75rem;
		}
		
		.entry-content {
			flex-direction: column;
		}
		
		.entry-time-column {
			flex-direction: row;
			padding: 0.75rem 1rem;
			border-right: none;
			border-bottom: 1px solid rgba(45, 166, 180, 0.08); /* Secondary-500 with opacity */
			justify-content: flex-start;
			gap: 0.75rem;
			width: 100%;
		}
		
		.time-divider {
			width: 12px;
			height: 2px;
			margin: 0;
		}
		
		.entry-details {
			padding: 1rem;
		}
	}
</style>