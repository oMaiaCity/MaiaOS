<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { GlassCard, LoadingSpinner, Alert, BackgroundBlobs } from '@hominio/brand';
	import { loadAgentConfig, getMenuContextString } from '@hominio/agents';

	// Load agent config
	let agentConfig = $state(null);
	let loading = $state(true);
	let error = $state(null);

	// Preview menu context string
	let menuContextPreview = $state('');

	onMount(async () => {
		try {
			const config = await loadAgentConfig('charles');
			agentConfig = config;

			// Generate menu context preview if menu skill exists
			const menuSkill = config.skills?.find((s: any) => s.id === 'show-menu');
			if (menuSkill?.dataContext) {
				const menuDataContext = Array.isArray(menuSkill.dataContext) 
					? menuSkill.dataContext.find((item: any) => item.id === 'menu')
					: menuSkill.dataContext.id === 'menu' ? menuSkill.dataContext : null;

				if (menuDataContext?.data) {
					menuContextPreview = getMenuContextString(menuDataContext.data, menuDataContext);
				}
			}

			loading = false;
		} catch (err) {
			console.error('[Charles Admin] Failed to load agent config:', err);
			error = err instanceof Error ? err.message : 'Fehler beim Laden der Agent-Konfiguration';
			loading = false;
		}
	});

	function formatJSON(obj: any): string {
		return JSON.stringify(obj, null, 2);
	}
</script>

<div class="relative min-h-screen overflow-x-hidden bg-glass-gradient px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
	<BackgroundBlobs />

	<div class="relative z-10 mx-auto max-w-6xl py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-slate-900">Charles Admin</h1>
				<p class="mt-2 text-sm text-slate-600">Agent-Konfiguration und Prompts verwalten</p>
			</div>
			<button
				onclick={() => goto('/me/charles')}
				class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
			>
				← Zurück zu Charles
			</button>
		</div>

		{#if loading}
			<div class="flex justify-center py-12">
				<LoadingSpinner />
			</div>
		{:else if error}
			<div class="py-12">
				<Alert type="warning" class="mx-auto max-w-md">
					<p class="font-medium">Fehler</p>
					<p class="mt-1 text-sm opacity-80">{error}</p>
				</Alert>
			</div>
		{:else if agentConfig}
			<div class="space-y-8">
				<!-- Agent Metadata -->
				<GlassCard class="p-6">
					<h2 class="mb-4 text-xl font-bold text-slate-900">Agent-Metadaten</h2>
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-slate-700">ID</label>
							<div class="mt-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900">
								{agentConfig.id}
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-slate-700">Name</label>
							<div class="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
								{agentConfig.name}
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-slate-700">Rolle</label>
							<div class="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
								{agentConfig.role}
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-slate-700">Beschreibung</label>
							<div class="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900">
								{agentConfig.description}
							</div>
						</div>
					</div>
				</GlassCard>

				<!-- Global Data Context -->
				<GlassCard class="p-6">
					<h2 class="mb-4 text-xl font-bold text-slate-900">Globaler Datenkontext</h2>
					<p class="mb-4 text-sm text-slate-600">
						Dieser Kontext wird beim Agent-Wechsel an die LLM gesendet (nicht beim Tool-Call).
					</p>
					{#if agentConfig.dataContext && agentConfig.dataContext.length > 0}
						<div class="space-y-4">
							{#each agentConfig.dataContext as contextItem, index}
								<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
									<div class="mb-2 flex items-center justify-between">
										<h3 class="text-sm font-semibold text-slate-900">
											{contextItem.title || `Kontext ${index + 1}`}
										</h3>
										{#if contextItem.id}
											<span class="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
												ID: {contextItem.id}
											</span>
										{/if}
									</div>
									{#if contextItem.description}
										<p class="mb-2 text-xs text-slate-600">{contextItem.description}</p>
									{/if}
									{#if contextItem.content}
										<div class="rounded bg-white p-3 text-sm text-slate-800 whitespace-pre-wrap">
											{contextItem.content}
										</div>
									{/if}
									{#if contextItem.data}
										<details class="mt-2">
											<summary class="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
												JSON-Daten anzeigen
											</summary>
											<pre class="mt-2 overflow-x-auto rounded bg-white p-3 text-xs text-slate-800">{formatJSON(contextItem.data)}</pre>
										</details>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-slate-500">Kein globaler Datenkontext definiert.</p>
					{/if}
				</GlassCard>

				<!-- Skills -->
				<GlassCard class="p-6">
					<h2 class="mb-4 text-xl font-bold text-slate-900">Skills</h2>
					<p class="mb-4 text-sm text-slate-600">
						Jeder Skill kann einen eigenen Datenkontext haben, der nur beim Tool-Call injiziert wird.
					</p>
					{#if agentConfig.skills && agentConfig.skills.length > 0}
						<div class="space-y-6">
							{#each agentConfig.skills as skill}
								<div class="rounded-lg border border-slate-200 bg-slate-50 p-5">
									<div class="mb-4 flex items-start justify-between">
										<div class="flex-1">
											<h3 class="text-lg font-semibold text-slate-900">{skill.name}</h3>
											<p class="mt-1 text-sm text-slate-600">{skill.description}</p>
											<div class="mt-2 flex flex-wrap gap-2">
												<span class="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
													ID: {skill.id}
												</span>
												<span class="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
													Function: {skill.functionId}
												</span>
											</div>
										</div>
									</div>

									<!-- Parameters -->
									{#if skill.parameters && Object.keys(skill.parameters).length > 0}
										<div class="mb-4">
											<h4 class="mb-2 text-sm font-semibold text-slate-700">Parameter</h4>
											<div class="rounded bg-white p-3">
												<pre class="text-xs text-slate-800">{formatJSON(skill.parameters)}</pre>
											</div>
										</div>
									{/if}

									<!-- Skill-specific Data Context -->
									{#if skill.dataContext}
										<div class="mb-4">
											<h4 class="mb-2 text-sm font-semibold text-slate-700">Skill-spezifischer Datenkontext</h4>
											<p class="mb-2 text-xs text-slate-600">
												Dieser Kontext wird nur beim Tool-Call für diesen Skill injiziert.
											</p>
											{#each (Array.isArray(skill.dataContext) ? skill.dataContext : [skill.dataContext]) as contextItem}
												<div class="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
													<div class="mb-2 flex items-center justify-between">
														<h5 class="text-sm font-semibold text-slate-900">
															{contextItem.title || 'Datenkontext'}
														</h5>
														{#if contextItem.id}
															<span class="rounded-full bg-blue-200 px-2 py-1 text-xs font-medium text-blue-900">
																ID: {contextItem.id}
															</span>
														{/if}
													</div>
													{#if contextItem.description}
														<p class="mb-2 text-xs text-slate-600">{contextItem.description}</p>
													{/if}

													<!-- Instructions -->
													{#if contextItem.instructions}
														<div class="mb-3">
															<h6 class="mb-2 text-xs font-semibold text-slate-700">Instruktionen</h6>
															<div class="rounded bg-white p-3 text-xs text-slate-800">
																{#each contextItem.instructions as instruction}
																	<div class="mb-1">{instruction}</div>
																{/each}
															</div>
														</div>
													{/if}

													<!-- Reminder -->
													{#if contextItem.reminder}
														<div class="mb-3">
															<h6 class="mb-2 text-xs font-semibold text-slate-700">Erinnerung</h6>
															<div class="rounded bg-white p-3 text-xs text-slate-800">
																{contextItem.reminder}
															</div>
														</div>
													{/if}

													<!-- Currency & Category Names -->
													{#if contextItem.currency || contextItem.categoryNames}
														<div class="mb-3 grid grid-cols-2 gap-3">
															{#if contextItem.currency}
																<div>
																	<h6 class="mb-1 text-xs font-semibold text-slate-700">Währung</h6>
																	<div class="rounded bg-white p-2 text-xs text-slate-800">
																		{contextItem.currency.code} ({contextItem.currency.locale})
																	</div>
																</div>
															{/if}
															{#if contextItem.categoryNames}
																<div>
																	<h6 class="mb-1 text-xs font-semibold text-slate-700">Kategorienamen</h6>
																	<div class="rounded bg-white p-2 text-xs text-slate-800">
																		<pre>{formatJSON(contextItem.categoryNames)}</pre>
																	</div>
																</div>
															{/if}
														</div>
													{/if}

													<!-- Error Message -->
													{#if contextItem.errorMessage}
														<div class="mb-3">
															<h6 class="mb-1 text-xs font-semibold text-slate-700">Fehlermeldung</h6>
															<div class="rounded bg-red-50 p-2 text-xs text-red-800">
																{contextItem.errorMessage}
															</div>
														</div>
													{/if}

													<!-- Data Preview -->
													{#if contextItem.data}
														<details class="mt-2">
															<summary class="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
																Daten anzeigen ({Object.keys(contextItem.data).length} Kategorien)
															</summary>
															<div class="mt-2 rounded bg-white p-3">
																<pre class="max-h-96 overflow-y-auto text-xs text-slate-800">{formatJSON(contextItem.data)}</pre>
															</div>
														</details>
													{/if}

													<!-- Menu Context Preview (for show-menu skill) -->
													{#if contextItem.id === 'menu' && menuContextPreview}
														<div class="mt-4">
															<h6 class="mb-2 text-xs font-semibold text-slate-700">Generierter Prompt (Vorschau)</h6>
															<div class="rounded bg-slate-900 p-4 text-xs text-green-400 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
																{menuContextPreview}
															</div>
															<p class="mt-2 text-xs text-slate-500">
																Dieser Prompt wird beim show-menu Tool-Call an die LLM gesendet.
															</p>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{:else}
										<p class="text-xs text-slate-500">Kein skill-spezifischer Datenkontext definiert.</p>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-slate-500">Keine Skills definiert.</p>
					{/if}
				</GlassCard>

				<!-- Raw JSON -->
				<GlassCard class="p-6">
					<h2 class="mb-4 text-xl font-bold text-slate-900">Roh-Konfiguration (JSON)</h2>
					<details>
						<summary class="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900">
							Vollständige JSON-Konfiguration anzeigen
						</summary>
						<pre class="mt-4 max-h-96 overflow-y-auto rounded bg-slate-900 p-4 text-xs text-green-400 font-mono">{formatJSON(agentConfig)}</pre>
					</details>
				</GlassCard>
			</div>
		{/if}
	</div>
</div>

