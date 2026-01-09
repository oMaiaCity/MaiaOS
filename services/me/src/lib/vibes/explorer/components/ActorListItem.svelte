<script lang="ts">
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Actor = any;

	interface Props {
		actor: Actor;
		actors: Actor[]; // Full list to look up roles by ID
		onSelect?: (actor: Actor) => void;
	}

	const { actor, actors, onSelect }: Props = $props();

	const actorId = $derived(actor?.$jazz?.id || '');
	const role = $derived(actor?.role || 'unknown');
	
	// Determine actor type (composite or leaf)
	const actorType = $derived.by(() => {
		if (!actor?.view) return 'unknown';
		const view = actor.view as Record<string, unknown>;
		if (view.container || (view.foreach as any)?.composite) return 'composite';
		if (view.tag) return 'leaf';
		return 'unknown';
	});

	// Shorten actor ID for display
	const shortId = $derived(actorId ? `${actorId.slice(0, 10)}...` : '');

	// Extract metadata reactively
	const childrenCount = $derived.by(() => {
		if (!actor?.children?.$isLoaded) return 0;
		return Array.from(actor.children).length;
	});

	const subscriptionsCount = $derived.by(() => {
		if (!actor?.subscriptions?.$isLoaded) return 0;
		return Array.from(actor.subscriptions).length;
	});

	const dependenciesCount = $derived.by(() => {
		if (!actor?.dependencies) return 0;
		return Object.keys(actor.dependencies).length;
	});

	// Extract dependencies details
	const dependenciesDetails = $derived.by(() => {
		if (!actor?.dependencies) return [];
		return Object.entries(actor.dependencies).map(([name, id]) => ({
			name,
			id: id as string
		}));
	});


	const hasQueries = $derived.by(() => {
		if (!actor?.context) return false;
		const context = actor.context as Record<string, unknown>;
		return !!(context.queries && typeof context.queries === 'object');
	});

	const isVisible = $derived.by(() => {
		if (!actor?.context) return false;
		const context = actor.context as Record<string, unknown>;
		return context.visible === true;
	});

	// Extract context keys (excluding internal ones)
	const contextKeys = $derived.by(() => {
		if (!actor?.context) return [];
		const context = actor.context as Record<string, unknown>;
		return Object.keys(context).filter(key => 
			key !== 'consumedMessages' && 
			key !== 'visible' && 
			key !== 'queries'
		);
	});

	// Extract query details
	const queryDetails = $derived.by(() => {
		if (!actor?.context) return [];
		const context = actor.context as Record<string, unknown>;
		const queries = context.queries;
		if (!queries || typeof queries !== 'object') return [];
		return Object.keys(queries);
	});

	// Extract view details
	const viewDetails = $derived.by(() => {
		if (!actor?.view) return null;
		const view = actor.view as Record<string, unknown>;
		
		if (view.tag) {
			// Leaf node
			return {
				type: 'leaf',
				tag: view.tag as string,
				classes: (view.classes as string) || '',
				elements: view.elements as any[] || [],
				bindings: view.bindings as Record<string, unknown> || null,
				attributes: view.attributes as Record<string, unknown> || null,
				events: view.events as Record<string, unknown> || null
			};
		} else if (view.container) {
			// Composite node
			const container = view.container as Record<string, unknown>;
			return {
				type: 'composite',
				layout: container.layout as string || 'unknown',
				class: container.class as string || '',
				hasForeach: !!(view.foreach),
				events: view.events as Record<string, unknown> || null
			};
		}
		return null;
	});


	// Helper to get actor role by ID
	const getActorRole = (id: string): string => {
		const found = actors.find(a => a?.$jazz?.id === id);
		return found?.role || id.slice(0, 10) + '...';
	};

	// Extract children IDs and roles
	const childrenDetails = $derived.by(() => {
		if (!actor?.children?.$isLoaded) return [];
		const childIds = Array.from(actor.children) as string[];
		return childIds.map(id => ({
			id,
			role: getActorRole(id)
		}));
	});

	// Extract subscription IDs and roles
	const subscriptionsDetails = $derived.by(() => {
		if (!actor?.subscriptions?.$isLoaded) return [];
		const subIds = Array.from(actor.subscriptions) as string[];
		return subIds.map(id => ({
			id,
			role: getActorRole(id)
		}));
	});


	function handleClick() {
		if (onSelect) {
			onSelect(actor);
		}
	}
</script>

<div
	class="card p-3 flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow"
	onclick={handleClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}}
>
	<!-- Header: Role and Type -->
	<div class="flex items-center gap-2">
		<span class="font-semibold text-slate-900">{role}</span>
		<span
			class="px-2 py-0.5 text-xs rounded-full {actorType === 'composite'
				? 'bg-blue-100 text-blue-700'
				: actorType === 'leaf'
					? 'bg-green-100 text-green-700'
					: 'bg-gray-100 text-gray-700'}"
		>
			{actorType}
		</span>
		{#if isVisible}
			<span class="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">
				visible
			</span>
		{/if}
	</div>

	<!-- Children Details -->
	{#if childrenDetails.length > 0}
		<div class="mt-1 pt-2 border-t border-slate-200">
			<div class="text-xs text-slate-500 mb-1">Children:</div>
			<div class="flex flex-wrap gap-1">
				{#each childrenDetails as child}
					<span class="px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-700 border border-blue-200">
						{child.role}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Subscriptions Details -->
	{#if subscriptionsDetails.length > 0}
		<div class="mt-1 pt-2 border-t border-slate-200">
			<div class="text-xs text-slate-500 mb-1">Subscriptions:</div>
			<div class="flex flex-wrap gap-1">
				{#each subscriptionsDetails as sub}
					<span class="px-1.5 py-0.5 text-xs rounded bg-green-50 text-green-700 border border-green-200">
						{sub.role}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Dependencies Details -->
	{#if dependenciesDetails.length > 0}
		<div class="mt-1 pt-2 border-t border-slate-200">
			<div class="text-xs text-slate-500 mb-1">Dependencies:</div>
			<div class="flex flex-col gap-1">
				{#each dependenciesDetails as dep}
					<div class="text-xs text-slate-700">
						<span class="font-semibold">{dep.name}:</span>
						<span class="font-mono text-slate-500 ml-1">{dep.id.slice(0, 10)}...</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- View Details -->
	{#if viewDetails}
		<div class="mt-1 pt-2 border-t border-slate-200">
			<div class="text-xs text-slate-500 mb-1">View:</div>
			
			{#if viewDetails.type === 'leaf'}
				<div class="flex flex-wrap gap-1 mb-2">
					<span class="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-xs">tag: {viewDetails.tag}</span>
				</div>
				
				<!-- Leaf Elements -->
				{#if viewDetails.elements && viewDetails.elements.length > 0}
					<div class="mb-2">
						<div class="text-xs text-slate-500 mb-1">Elements:</div>
						<div class="flex flex-wrap gap-1">
							{#each viewDetails.elements as element}
								<span class="px-1.5 py-0.5 text-xs rounded bg-slate-50 text-slate-700 border border-slate-200">
									{typeof element === 'string' ? element : JSON.stringify(element)}
								</span>
							{/each}
						</div>
					</div>
				{/if}
				
				<!-- Leaf Bindings -->
				{#if viewDetails.bindings && Object.keys(viewDetails.bindings).length > 0}
					<div class="mb-2">
						<div class="text-xs text-slate-500 mb-1">Bindings:</div>
						<div class="flex flex-col gap-0.5">
							{#each Object.entries(viewDetails.bindings) as [key, value]}
								<div class="text-xs text-slate-700">
									<span class="font-mono text-slate-600">{key}:</span>
									<span class="ml-1 text-slate-500">{String(value)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				
				<!-- Leaf Attributes -->
				{#if viewDetails.attributes && Object.keys(viewDetails.attributes).length > 0}
					<div class="mb-2">
						<div class="text-xs text-slate-500 mb-1">Attributes:</div>
						<div class="flex flex-wrap gap-1">
							{#each Object.entries(viewDetails.attributes) as [key, value]}
								<span class="px-1.5 py-0.5 text-xs rounded bg-slate-50 text-slate-700 border border-slate-200">
									{key}={String(value)}
								</span>
							{/each}
						</div>
					</div>
				{/if}
				
			{:else if viewDetails.type === 'composite'}
				<div class="flex flex-wrap gap-1 mb-2">
					<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">layout: {viewDetails.layout}</span>
					{#if viewDetails.hasForeach}
						<span class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-xs">foreach</span>
					{/if}
				</div>
			{/if}
			
			<!-- Events (for both leaf and composite) -->
			{#if viewDetails.events && Object.keys(viewDetails.events).length > 0}
				<div class="mb-2">
					<div class="text-xs text-slate-500 mb-1">Events:</div>
					<div class="flex flex-col gap-1">
						{#each Object.entries(viewDetails.events) as [eventType, eventConfig]}
							<div class="text-xs bg-yellow-50 border border-yellow-200 rounded p-1.5">
								<div class="flex items-center gap-1 mb-0.5">
									<span class="font-semibold text-yellow-800">{eventType}</span>
									<span class="text-yellow-600">→</span>
									<span class="font-mono text-yellow-700">{(eventConfig as any)?.event || 'unknown'}</span>
								</div>
								{#if (eventConfig as any)?.payload}
									<div class="text-yellow-600 ml-1">
										payload: {JSON.stringify((eventConfig as any).payload)}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Context Details -->
	{#if contextKeys.length > 0 || queryDetails.length > 0}
		<div class="mt-1 pt-2 border-t border-slate-200">
			<div class="text-xs text-slate-500 mb-1">Context:</div>
			<div class="flex flex-wrap gap-1">
				{#if queryDetails.length > 0}
					{#each queryDetails as queryName}
						<span class="px-1.5 py-0.5 text-xs rounded bg-orange-50 text-orange-700 border border-orange-200">
							query: {queryName}
						</span>
					{/each}
				{/if}
				{#each contextKeys as key}
					<span class="px-1.5 py-0.5 text-xs rounded bg-slate-50 text-slate-700 border border-slate-200">
						{key}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Footer: Actor ID -->
	<div class="text-xs text-slate-400 mt-1 font-mono">{shortId}</div>
</div>
