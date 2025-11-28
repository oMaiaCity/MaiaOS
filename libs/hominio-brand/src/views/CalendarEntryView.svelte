<!--
	Calendar Entry View Component (Pure View)
	Displays created or edited calendar entry with success confirmation
	Pure presentation component - no business logic
-->
<script lang="ts">
	import GlassCard from '../components/GlassCard.svelte';

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
		<!-- Entry Card - Compact, refined styling matching reference -->
		<GlassCard class="p-0 overflow-hidden border-0 bg-white/80 backdrop-blur-xl shadow-lg shadow-secondary-500/5 rounded-2xl mb-6 animate-slide-up" lifted={true}>
			<div class="flex flex-row items-stretch">
				<!-- Time Column - More prominent secondary gradient background -->
				<div class="flex flex-col items-center justify-center py-8 px-6 bg-gradient-to-br from-[#45b8c826] via-[#2da6b41a] to-[#2585900d] min-w-[100px] border-r border-[#99dfe74d]">
					<span class="text-2xl font-extrabold text-[var(--color-secondary-700)] leading-none mb-1.5">{formatTime(resolvedEntry.time)}</span>
					<div class="w-0.5 h-6 bg-gradient-to-b from-[#45b8c880] via-[#2da6b44d] to-[#25859033] my-2 rounded-full"></div>
					<span class="text-sm font-semibold text-[var(--color-secondary-600)]">{calculateEndTime(resolvedEntry.time, resolvedEntry.duration)}</span>
				</div>
				
				<!-- Details Column -->
				<div class="flex-1 py-6 px-6 flex flex-col justify-center">
					<div class="flex items-start justify-between mb-3 gap-3">
						<h3 class="text-xl font-bold text-slate-800 m-0 leading-tight flex-1">{resolvedEntry.title}</h3>
						<span class="text-[0.65rem] bg-gradient-to-r from-[var(--color-secondary-500)] to-[var(--color-secondary-600)] text-white px-2.5 py-1 rounded-full font-bold tracking-wider uppercase flex-shrink-0 shadow-sm">
							{badgeText}
						</span>
					</div>
					
					<div class="flex items-center gap-4 mb-2">
						<span class="text-sm text-slate-600 font-medium">{formatDate(resolvedEntry.date)}</span>
						<span class="inline-flex items-center gap-1.5 text-xs text-[var(--color-secondary-600)] bg-gradient-to-r from-[#2da6b426] to-[#2da6b414] px-2.5 py-1 rounded-md font-semibold">
							<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10"></circle>
								<polyline points="12 6 12 12 16 14"></polyline>
							</svg>
							{formatDuration(resolvedEntry.duration)}
						</span>
					</div>
					
					{#if resolvedEntry.description}
						<p class="text-sm text-slate-600 leading-relaxed mt-2 pt-3 border-t border-slate-200/20">{resolvedEntry.description}</p>
					{/if}
				</div>
			</div>
		</GlassCard>
		
		<!-- Success Indicator - Compact below card -->
		<div class="text-center">
			<div class="inline-flex items-center gap-2 text-sm text-[var(--color-secondary-600)] font-medium">
				<div class="w-5 h-5 bg-gradient-to-br from-[#45b8c833] to-[#2da6b426] rounded-full flex items-center justify-center">
					<svg class="w-3 h-3 text-[var(--color-secondary-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<span>{actionTitle}</span>
			</div>
		</div>
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

