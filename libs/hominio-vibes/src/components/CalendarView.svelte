<!--
	Calendar UI Component
	Displays calendar entries in a week view (today + next 6 days)
	Top-to-bottom list with glass card styling
-->
<script>
	import { GlassCard } from '@hominio/brand';
	import { calendarEntries } from '@hominio/vibes';
	
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

<div class="w-full max-w-3xl mx-auto p-4 sm:p-6">
	<!-- Header -->
	<div class="mb-10 text-center">
		<h2 class="text-3xl sm:text-4xl font-extrabold mb-2 bg-gradient-to-br from-secondary-400 to-secondary-500 bg-clip-text text-transparent tracking-tight">
			Dein Kalender
		</h2>
		{#if weekStart && weekEnd}
			<p class="text-sm sm:text-base text-primary-600 font-medium">
				{new Date(weekStart).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} - 
				{new Date(weekEnd).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
			</p>
		{/if}
	</div>
	
	<!-- Week View: Top to Bottom List -->
	<div class="flex flex-col gap-10">
		{#each weekDates as { date, dateObj, isToday } (date)}
			{@const dayEntries = entriesByDate[date] || []}
			<div class="w-full relative">
				<!-- Day Header -->
				<div class="flex items-center justify-between mb-5 pl-2 pb-2 border-b border-slate-200/30">
					<h3 class="text-xl font-bold {isToday ? 'text-secondary-500' : 'text-primary-800'} m-0 flex items-center gap-3">
						{formatDate(dateObj)}
						{#if isToday}
							<span class="text-[0.7rem] bg-secondary-500 text-white px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">
								HEUTE
							</span>
						{/if}
					</h3>
					{#if dayEntries.length > 0}
						<span class="text-sm text-primary-600 font-medium bg-primary-50/50 px-3 py-1 rounded-full">
							{dayEntries.length} {dayEntries.length === 1 ? 'Termin' : 'Termine'}
						</span>
					{/if}
				</div>
				
				<!-- Day Entries -->
				{#if dayEntries.length > 0}
					<div class="flex flex-col gap-4">
						{#each dayEntries as entry (entry.id)}
							<GlassCard class="p-0 overflow-hidden border border-white/40 bg-white/60 shadow-sm rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-white/80 hover:shadow-lg hover:shadow-secondary-500/10 hover:border-secondary-400/30">
								<div class="flex flex-row items-stretch">
									<!-- Time Column -->
									<div class="flex flex-col items-center justify-center py-6 px-5 bg-secondary-500/3 border-r border-secondary-500/8 min-w-[90px]">
										<span class="text-lg font-bold text-primary-800 leading-none">{formatTime(entry.time)}</span>
										<div class="w-0.5 h-3 bg-secondary-500/30 my-1.5 rounded-sm"></div>
										<span class="text-sm font-medium text-primary-600">{calculateEndTime(entry.time, entry.duration)}</span>
									</div>
									
									<!-- Details Column -->
									<div class="flex-1 py-5 px-6 flex flex-col justify-center">
										<h4 class="text-lg font-semibold text-primary-800 mb-2 leading-tight">{entry.title}</h4>
										
										<div class="flex items-center gap-3 mb-2">
											<span class="inline-flex items-center gap-1.5 text-xs text-secondary-500 bg-secondary-500/10 px-2.5 py-1 rounded-md font-semibold">
												<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<circle cx="12" cy="12" r="10"></circle>
													<polyline points="12 6 12 12 16 14"></polyline>
												</svg>
												{formatDuration(entry.duration)}
											</span>
										</div>
										
										{#if entry.description}
											<p class="text-sm text-primary-600 leading-relaxed mt-1">{entry.description}</p>
										{/if}
									</div>
								</div>
							</GlassCard>
						{/each}
					</div>
				{:else}
					<div class="py-6 flex items-center gap-4 opacity-50">
						<span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
						<p class="text-sm text-primary-500 m-0 italic">Keine Termine</p>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	
	<!-- Empty State (if no entries at all) -->
	{#if entries.length === 0}
		<div class="mt-16 flex justify-center">
			<GlassCard class="p-12 max-w-md text-center">
				<div class="flex flex-col items-center gap-6">
					<div class="w-20 h-20 bg-secondary-500/10 rounded-full flex items-center justify-center mb-2">
						<svg class="w-10 h-10 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<h3 class="text-xl font-bold text-primary-800 m-0">Keine Termine vorhanden</h3>
					<p class="text-sm text-primary-600 m-0 leading-relaxed">Erstelle einen neuen Termin, um zu beginnen.</p>
				</div>
			</GlassCard>
		</div>
	{/if}
</div>

<style>
	/* Mobile Responsive */
	@media (max-width: 640px) {
		:global(.calendar-entry-card .flex-row) {
			flex-direction: column;
		}
		
		:global(.calendar-entry-card .flex-row > div:first-child) {
			flex-direction: row;
			padding: 0.75rem 1rem;
			border-right: none;
			border-bottom: 1px solid rgba(45, 166, 180, 0.08);
			justify-content: flex-start;
			gap: 0.75rem;
			width: 100%;
		}
		
		:global(.calendar-entry-card .flex-row > div:first-child > div:first-child) {
			width: 12px;
			height: 2px;
			margin: 0;
		}
		
		:global(.calendar-entry-card .flex-row > div:last-child) {
			padding: 1rem;
		}
	}
</style>
