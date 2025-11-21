<script lang="ts">
	import { onMount } from 'svelte';
	import { getZeroContext } from '$lib/zero-utils';
	import { allDataBySchema } from '@hominio/zero';
	import { GlassCard, GlassButton, LoadingSpinner, Alert } from '@hominio/brand';
	import { createAuthClient } from '@hominio/auth';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const auth = createAuthClient();
	const session = auth.useSession();

	// Hotels state
	/** @type {Array<{id: string, ownedBy: string, schema: string, data: string}>} */
	let hotels = $state([]);
	let loading = $state(true);
	/** @type {string | null} */
	let error = $state(null);

	// Form state
	let showForm = $state(false);
	let editingHotel = $state<{id: string, data: any} | null>(null);
	let formData = $state({
		name: '',
		address: '',
		city: '',
		country: '',
		rating: undefined as number | undefined,
	});

	// Zero context
	const zeroContext = getZeroContext();

	onMount(() => {
		if (!zeroContext) {
			error = 'Zero context not available';
			loading = false;
			return;
		}

		let hotelsView: any;

		(async () => {
			// Wait for Zero to be ready
			while (!zeroContext.isReady() || !zeroContext.getInstance()) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			const zero = zeroContext.getInstance();

			if (!zero) {
				loading = false;
				error = 'Fehler beim Initialisieren des Zero-Clients';
				return;
			}

			try {
				// Query all hotels using synced query
				const hotelsQuery = allDataBySchema('hotel-schema-v1');
				hotelsView = zero.materialize(hotelsQuery);

				hotelsView.addListener((data: any) => {
					const newHotels = Array.from(data || []);
					hotels = newHotels;
					loading = false;
					error = null;
				});
			} catch (err) {
				console.error('Error setting up Zero query:', err);
				error = err instanceof Error ? err.message : 'Fehler beim Laden der Hotels';
				loading = false;
			}
		})();

		return () => {
			if (hotelsView) hotelsView.destroy();
		};
	});

	async function handleCreate() {
		if (!zeroContext || !zeroContext.getInstance()) {
			error = 'Zero context not available';
			return;
		}

		const zero = zeroContext.getInstance();
		if (!zero) {
			error = 'Zero instance not available';
			return;
		}

		// Wait for session to be ready
		while ($session.isPending) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		if (!$session.data?.user?.id) {
			error = 'Nicht angemeldet';
			return;
		}

		try {
			// Validate form data
			if (!formData.name || !formData.address || !formData.city || !formData.country) {
				error = 'Bitte füllen Sie alle Pflichtfelder aus';
				return;
			}

			const hotelData = {
				name: formData.name.trim(),
				address: formData.address.trim(),
				city: formData.city.trim(),
				country: formData.country.trim(),
				...(formData.rating !== undefined && formData.rating > 0 ? { rating: formData.rating } : {}),
			};

			const hotelId = `hotel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			// Create hotel using Zero mutator
			// Zero's json() type accepts objects directly, no need to stringify
			await zero.mutate.data.create({
				id: hotelId,
				ownedBy: $session.data.user.id,
				schema: 'hotel-schema-v1',
				data: hotelData, // Pass object directly - Zero's json() type handles it
			});

			// Reset form
			formData = {
				name: '',
				address: '',
				city: '',
				country: '',
				rating: undefined,
			};
			showForm = false;
			error = null;
		} catch (err) {
			console.error('Error creating hotel:', err);
			error = err instanceof Error ? err.message : 'Fehler beim Erstellen des Hotels';
		}
	}

	async function handleEdit(hotel: {id: string, data: any}) {
		if (!zeroContext || !zeroContext.getInstance()) {
			error = 'Zero context not available';
			return;
		}

		const zero = zeroContext.getInstance();
		if (!zero) {
			error = 'Zero instance not available';
			return;
		}

		// Wait for session to be ready
		while ($session.isPending) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		if (!$session.data?.user?.id) {
			error = 'Nicht angemeldet';
			return;
		}

		try {
			// Zero's json() type returns the parsed object directly
			const hotelData = hotel.data;

			// Validate form data
			if (!formData.name || !formData.address || !formData.city || !formData.country) {
				error = 'Bitte füllen Sie alle Pflichtfelder aus';
				return;
			}

			const updatedData = {
				name: formData.name.trim(),
				address: formData.address.trim(),
				city: formData.city.trim(),
				country: formData.country.trim(),
				...(formData.rating !== undefined && formData.rating > 0 ? { rating: formData.rating } : {}),
			};

			// Update hotel using Zero mutator
			// Zero's json() type accepts objects directly
			await zero.mutate.data.update({
				id: hotel.id,
				data: updatedData, // Pass object directly - Zero's json() type handles it
			});

			// Reset form
			editingHotel = null;
			formData = {
				name: '',
				address: '',
				city: '',
				country: '',
				rating: undefined,
			};
			showForm = false;
			error = null;
		} catch (err) {
			console.error('Error updating hotel:', err);
			error = err instanceof Error ? err.message : 'Fehler beim Aktualisieren des Hotels';
		}
	}

	async function handleDelete(hotelId: string) {
		if (!confirm('Möchten Sie dieses Hotel wirklich löschen?')) {
			return;
		}

		if (!zeroContext || !zeroContext.getInstance()) {
			error = 'Zero context not available';
			return;
		}

		const zero = zeroContext.getInstance();
		if (!zero) {
			error = 'Zero instance not available';
			return;
		}

		try {
			// Delete hotel using Zero mutator
			await zero.mutate.data.delete({ id: hotelId });
			error = null;
		} catch (err) {
			console.error('Error deleting hotel:', err);
			error = err instanceof Error ? err.message : 'Fehler beim Löschen des Hotels';
		}
	}

	function startEdit(hotel: {id: string, data: any}) {
		// Zero's json() type returns the parsed object directly
		const hotelData = hotel.data;
		editingHotel = hotel;
		formData = {
			name: hotelData.name || '',
			address: hotelData.address || '',
			city: hotelData.city || '',
			country: hotelData.country || '',
			rating: hotelData.rating,
		};
		showForm = true;
	}

	function cancelEdit() {
		editingHotel = null;
		formData = {
			name: '',
			address: '',
			city: '',
			country: '',
			rating: undefined,
		};
		showForm = false;
	}
</script>

<div class="min-h-screen bg-glass-gradient pt-6 pb-12">
	<div class="container mx-auto px-4 max-w-5xl">
		<div class="mb-8">
			<h1 class="text-4xl font-bold tracking-tight text-slate-900 mb-2">Hotel Verwaltung</h1>
			<p class="text-slate-600">Verwalten Sie Hotels im System</p>
		</div>

		{#if error}
			<GlassCard class="p-6 mb-6">
				<Alert type="warning">
					<p class="font-medium">Fehler</p>
					<p class="mt-1 text-sm opacity-80">{error}</p>
				</Alert>
			</GlassCard>
		{/if}

		<div class="mb-6">
			{#if !showForm}
				<GlassButton onclick={() => showForm = true} variant="navy">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					<span>Neues Hotel hinzufügen</span>
				</GlassButton>
			{/if}
		</div>

		{#if showForm}
			<GlassCard class="p-6 mb-6">
				<h2 class="text-2xl font-bold mb-4 text-slate-900">
					{editingHotel ? 'Hotel bearbeiten' : 'Neues Hotel hinzufügen'}
				</h2>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						if (editingHotel) {
							handleEdit(editingHotel);
						} else {
							handleCreate();
						}
					}}
					class="space-y-4"
				>
					<div>
						<label for="name" class="block text-sm font-medium text-slate-700 mb-1">
							Hotelname <span class="text-red-500">*</span>
						</label>
						<input
							id="name"
							type="text"
							bind:value={formData.name}
							required
							class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="address" class="block text-sm font-medium text-slate-700 mb-1">
							Adresse <span class="text-red-500">*</span>
						</label>
						<input
							id="address"
							type="text"
							bind:value={formData.address}
							required
							class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="city" class="block text-sm font-medium text-slate-700 mb-1">
								Stadt <span class="text-red-500">*</span>
							</label>
							<input
								id="city"
								type="text"
								bind:value={formData.city}
								required
								class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
							/>
						</div>

						<div>
							<label for="country" class="block text-sm font-medium text-slate-700 mb-1">
								Land <span class="text-red-500">*</span>
							</label>
							<input
								id="country"
								type="text"
								bind:value={formData.country}
								required
								class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
							/>
						</div>
					</div>

					<div>
						<label for="rating" class="block text-sm font-medium text-slate-700 mb-1">
							Bewertung (1-5 Sterne)
						</label>
						<input
							id="rating"
							type="number"
							min="1"
							max="5"
							bind:value={formData.rating}
							class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
						/>
					</div>

					<div class="flex gap-3">
						<GlassButton type="submit" variant="navy">
							{editingHotel ? 'Aktualisieren' : 'Erstellen'}
						</GlassButton>
						<GlassButton type="button" onclick={cancelEdit} variant="danger">
							Abbrechen
						</GlassButton>
					</div>
				</form>
			</GlassCard>
		{/if}

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<LoadingSpinner />
				<p class="ml-4 text-sm font-medium text-slate-500">Hotels werden geladen...</p>
			</div>
		{:else if hotels.length === 0}
			<GlassCard class="p-8 text-center">
				<p class="text-slate-600">Noch keine Hotels vorhanden.</p>
			</GlassCard>
		{:else}
			<div class="grid gap-4">
				{#each hotels as hotel (hotel.id)}
					{@const hotelData = hotel.data}
					<GlassCard class="p-6">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<h3 class="text-xl font-semibold text-slate-900 mb-2">
									{hotelData.name || 'Unnamed Hotel'}
								</h3>
								<p class="text-sm text-slate-600 mb-1">
									{hotelData.address}
								</p>
								<p class="text-sm text-slate-500 mb-2">
									{hotelData.city}{hotelData.city && hotelData.country ? ', ' : ''}{hotelData.country}
								</p>
								{#if hotelData.rating}
									<p class="text-sm text-slate-400">
										{'⭐'.repeat(hotelData.rating)} {hotelData.rating}/5
									</p>
								{/if}
							</div>
							<div class="flex gap-2">
								<GlassButton
									onclick={() => startEdit(hotel)}
									variant="navy"
									class="px-3 py-1 text-sm"
								>
									Bearbeiten
								</GlassButton>
								<GlassButton
									onclick={() => handleDelete(hotel.id)}
									variant="danger"
									class="px-3 py-1 text-sm"
								>
									Löschen
								</GlassButton>
							</div>
						</div>
					</GlassCard>
				{/each}
			</div>
		{/if}
	</div>
</div>

