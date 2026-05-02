/**
 * Single source of truth for spark.os → peer.infra. Seed writes {@link slotKey};
 * {@link loadInfraFromSparkOs} reads them into {@link infraKey}.
 * `basename` is seed-only (paired with `maiaIdentity` when resolving from registry).
 */
export const INFRA_SLOTS = Object.freeze([
	{ slotKey: 'metaFactoryCoId', basename: 'meta.factory.json', infraKey: 'meta' },
	{ slotKey: 'actorFactoryCoId', basename: 'actor.factory.json', infraKey: 'actor' },
	{ slotKey: 'eventFactoryCoId', basename: 'event.factory.json', infraKey: 'event' },
	{ slotKey: 'cobinaryFactoryCoId', basename: 'cobinary.factory.json', infraKey: 'cobinary' },
	{ slotKey: 'identityFactoryCoId', basename: 'identity.factory.json', infraKey: 'identity' },
	{
		slotKey: 'indexesRegistryFactoryCoId',
		basename: 'indexes-registry.factory.json',
		infraKey: 'indexesRegistry',
	},
	{ slotKey: 'capabilityFactoryCoId', basename: 'capability.factory.json', infraKey: 'capability' },
	{ slotKey: 'groupsFactoryCoId', basename: 'groups.factory.json', infraKey: 'groups' },
	{ slotKey: 'osRegistryFactoryCoId', basename: 'os-registry.factory.json', infraKey: 'osRegistry' },
	{
		slotKey: 'vibesRegistryFactoryCoId',
		basename: 'vibes-registry.factory.json',
		infraKey: 'vibesRegistry',
	},
	{ slotKey: 'dataSparkFactoryCoId', basename: 'spark.factory.json', infraKey: 'dataSpark' },
])
