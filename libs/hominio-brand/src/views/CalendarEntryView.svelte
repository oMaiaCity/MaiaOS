<!--
	Calendar Entry View Component (Pure View)
	Displays created or edited calendar entry with success confirmation
	Pure presentation component - no business logic
-->
<script lang="ts">
	import { GlassCard } from '@hominio/brand';

	import type { CalendarEntry } from './types.js';

	/**
	 * Calendar Entry View Props
	 * Compatible with UIRenderer which passes data={resultData}
	 */
	interface CalendarEntryViewProps {
		data?: {
			entry?: CalendarEntry;
			message?: string;
		};
		entry?: CalendarEntry;
		message?: string;
		onClose?: () => void;
	}

	let { data, entry, message, onClose }: CalendarEntryViewProps = $props();
	
	// Support both data prop (from UIRenderer) and flat props (direct usage)
	const resolvedEntry = $derived(entry || data?.entry);
	const resolvedMessage = $derived(message || data?.message || 'Termin erfolgreich erstellt');
	
	// Detect if this is an edit or create based on message
	const isEdit = $derived(resolvedMessage?.toLowerCase().includes('aktualisiert') || resolvedMessage?.toLowerCase().includes('bearbeitet'));
	const actionTitle = $derived(isEdit ? 'Termin aktualisiert' : 'Termin erstellt');
	const badgeText = $derived(isEdit ? 'AKTUALISIERT' : 'NEU');
	const errorTitle = $derived(isEdit ? 'Fehler beim Aktualisieren' : 'Fehler beim Erstellen');
	const errorMessage = $derived(isEdit ? 'Der Termin konnte nicht aktualisiert werden.' : 'Der Termin konnte nicht erstellt werden.');
	
	// Helper functions for formatting
	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr + 'T00:00:00'); // Parse as local date
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		
		if (date.toDateString() === today.toDateString()) {
			return 'Heute';
		}
		if (date.toDateString() === tomorrow.toDateString()) {
			return 'Morgen';
		}
		
		return date.toLocaleDateString('de-DE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}
	
	function formatTime(time: string): string {
		return time; // Already in HH:MM format
	}
	
	function calculateEndTime(startTime: string, duration: number): string {
		const [hours, minutes] = startTime.split(':').map(Number);
		const startMinutes = hours * 60 + minutes;
		const endMinutes = startMinutes + duration;
		const endHours = Math.floor(endMinutes / 60) % 24;
		const endMins = endMinutes % 60;
		return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
	}
	
	function formatDuration(duration: number): string {
		if (duration < 60) {
			return `${duration} Min`;
		}
		const hours = Math.floor(duration / 60);
		const minutes = duration % 60;
		if (minutes === 0) {
			return `${hours} ${hours === 1 ? 'Std' : 'Stunden'}`;
		}
		return `${hours} ${hours === 1 ? 'Std' : 'Stunden'} ${minutes} Min`;
	}
</script>

<div class="w-full max-w-2xl mx-auto p-6">
	{#if resolvedEntry}
		<!-- Success Header - Large checkmark like reference -->
		<div class="text-center mb-10">
			<div class="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-secondary-400/20 to-secondary-500/15 rounded-full flex items-center justify-center animate-scale-in">
				<svg class="w-8 h-8 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<h2 class="text-3xl sm:text-4xl font-extrabold italic bg-gradient-to-br from-secondary-400 to-secondary-500 bg-clip-text text-transparent mb-3 tracking-tight">{actionTitle}</h2>
			<p class="text-sm text-slate-600 font-medium m-0">{resolvedMessage}</p>
		</div>
		
		<!-- Entry Card - Enhanced styling with secondary colors matching reference -->
		<GlassCard class="p-0 overflow-hidden border-0 bg-white/70 backdrop-blur-md shadow-xl shadow-secondary-500/10 rounded-3xl mb-8 animate-slide-up" lifted={true}>
			<div class="flex flex-row items-stretch">
				<!-- Time Column - Secondary gradient background -->
				<div class="flex flex-col items-center justify-center py-10 px-7 bg-gradient-to-br from-secondary-500/5 to-secondary-500/10 min-w-[110px]">
					<span class="text-2xl font-extrabold text-slate-800 leading-none mb-2">{formatTime(resolvedEntry.time)}</span>
					<div class="w-1 h-5 bg-gradient-to-b from-secondary-400/40 to-secondary-500/20 my-2.5 rounded-full"></div>
					<span class="text-base font-semibold text-slate-600">{calculateEndTime(resolvedEntry.time, resolvedEntry.duration)}</span>
				</div>
				
				<!-- Details Column -->
				<div class="flex-1 py-8 px-9 flex flex-col justify-center">
					<div class="flex items-center justify-between mb-5 gap-4">
						<h3 class="text-2xl font-bold italic text-slate-800 m-0 leading-tight flex-1">{resolvedEntry.title}</h3>
						<span class="text-[0.7rem] bg-gradient-to-r from-secondary-400 to-secondary-500 text-white px-3 py-1.5 rounded-full font-bold tracking-wider uppercase flex-shrink-0 shadow-sm">
							{badgeText}
						</span>
					</div>
					
					<div class="flex flex-col gap-4 mb-5">
						<div class="flex items-center gap-3">
							<span class="text-base text-slate-600 font-medium">{formatDate(resolvedEntry.date)}</span>
						</div>
						
						<div class="flex items-center gap-3">
							<span class="inline-flex items-center gap-2 text-xs text-secondary-600 bg-gradient-to-r from-secondary-500/10 to-secondary-500/5 px-3 py-1.5 rounded-lg font-semibold">
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"></circle>
									<polyline points="12 6 12 12 16 14"></polyline>
								</svg>
								{formatDuration(resolvedEntry.duration)}
							</span>
						</div>
					</div>
					
					{#if resolvedEntry.description}
						<p class="text-sm text-slate-600 leading-relaxed mt-3 pt-5 border-t border-slate-200/30">{resolvedEntry.description}</p>
					{/if}
				</div>
			</div>
		</GlassCard>
	{:else}
		<!-- Error State -->
		<div class="mt-8">
			<GlassCard class="p-8 text-center">
				<div class="flex flex-col items-center gap-4">
					<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<h3 class="text-xl font-bold text-slate-800 m-0">{errorTitle}</h3>
					<p class="text-sm text-slate-600 m-0">{errorMessage}</p>
				</div>
			</GlassCard>
		</div>
	{/if}
</div>

<style>
	@keyframes scale-in {
		from {
			transform: scale(0);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	
	@keyframes slide-up {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	
	.animate-scale-in {
		animation: scale-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	.animate-slide-up {
		animation: slide-up 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	/* Mobile Responsive */
	@media (max-width: 640px) {
		:global(.new-entry-card .flex-row) {
			flex-direction: column;
		}
		
		:global(.new-entry-card .flex-row > div:first-child) {
			flex-direction: row;
			padding: 1rem 1.5rem;
			border-right: none;
			border-bottom: 2px solid rgba(45, 166, 180, 0.15);
			justify-content: flex-start;
			gap: 1rem;
			width: 100%;
		}
		
		:global(.new-entry-card .flex-row > div:first-child > div:first-child) {
			width: 16px;
			height: 3px;
			margin: 0;
		}
		
		:global(.new-entry-card .flex-row > div:last-child) {
			padding: 1.25rem 1.5rem;
		}
	}
</style>

