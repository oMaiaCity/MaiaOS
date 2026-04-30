/**
 * Single source of truth for spark.os → peer.infra. Seed writes {@link slotKey};
 * {@link loadInfraFromSparkOs} reads them into {@link infraKey}.
 * `basename` is seed-only (paired with `maiaIdentity` when resolving from registry).
 */
export const INFRA_SLOTS = Object.freeze([
	{ slotKey: 'metaFactoryCoId', basename: 'meta.factory.maia', infraKey: 'meta' },
	{ slotKey: 'actorFactoryCoId', basename: 'actor.factory.maia', infraKey: 'actor' },
	{ slotKey: 'eventFactoryCoId', basename: 'event.factory.maia', infraKey: 'event' },
	{ slotKey: 'cobinaryFactoryCoId', basename: 'cobinary.factory.maia', infraKey: 'cobinary' },
	{ slotKey: 'identityFactoryCoId', basename: 'identity.factory.maia', infraKey: 'identity' },
	{
		slotKey: 'indexesRegistryFactoryCoId',
		basename: 'indexes-registry.factory.maia',
		infraKey: 'indexesRegistry',
	},
	{ slotKey: 'capabilityFactoryCoId', basename: 'capability.factory.maia', infraKey: 'capability' },
	{ slotKey: 'groupsFactoryCoId', basename: 'groups.factory.maia', infraKey: 'groups' },
	{ slotKey: 'osRegistryFactoryCoId', basename: 'os-registry.factory.maia', infraKey: 'osRegistry' },
	{
		slotKey: 'vibesRegistryFactoryCoId',
		basename: 'vibes-registry.factory.maia',
		infraKey: 'vibesRegistry',
	},
	{ slotKey: 'dataSparkFactoryCoId', basename: 'spark.factory.maia', infraKey: 'dataSpark' },
])
