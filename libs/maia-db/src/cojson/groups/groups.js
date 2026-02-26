/**
 * Group Operations - Consolidated group helpers
 *
 * Provides all group-related operations: access, info extraction, and member management.
 */

import { waitForStoreReady } from '../crud/read-operations.js'

/**
 * Get a Group CoValue by ID
 * @param {LocalNode} node - LocalNode instance
 * @param {string} groupId - Group CoValue ID
 * @returns {Promise<RawGroup|null>} Group CoValue or null if not found
 */
export async function getGroup(node, groupId) {
	const groupCore = node.getCoValue(groupId)
	if (!groupCore || !(groupCore?.isAvailable() || false)) {
		return null
	}

	const content = groupCore?.getCurrentContent()
	if (!content || typeof content.addMember !== 'function') {
		return null
	}

	return content
}

/**
 * Get capability group co-id for a spark from spark.os.capabilities
 * Resolves: spark -> spark.os -> os.capabilities -> capabilities.get(capabilityName)
 * @param {Object} peer - Backend instance
 * @param {string} spark - Spark name (e.g. "°Maia") or spark co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
/**
 * Get capability group co-id from os CoMap id (os -> capabilities -> capabilityName)
 * Uses read() + waitForStoreReady to ensure os/capabilities are synced (e.g. when agent
 * loads human's spark via sync - os and capabilities must be fetched before access).
 * @param {Object} peer - Backend instance
 * @param {string} osId - OS CoMap co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
export async function getCapabilityGroupIdFromOsId(peer, osId, capabilityName) {
	if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) return null
	const osStore = await peer.read(null, osId)
	await waitForStoreReady(osStore, osId, 15000)
	const osCore = peer.getCoValue(osId)
	if (!osCore || !peer.isAvailable(osCore)) return null
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return null
	const capabilitiesId = osContent.get('capabilities')
	if (!capabilitiesId || typeof capabilitiesId !== 'string' || !capabilitiesId.startsWith('co_z'))
		return null
	const capabilitiesStore = await peer.read(null, capabilitiesId)
	await waitForStoreReady(capabilitiesStore, capabilitiesId, 15000)
	const capabilitiesCore = peer.getCoValue(capabilitiesId)
	if (!capabilitiesCore || !peer.isAvailable(capabilitiesCore)) return null
	const capabilitiesContent = peer.getCurrentContent(capabilitiesCore)
	if (!capabilitiesContent || typeof capabilitiesContent.get !== 'function') return null
	const groupId = capabilitiesContent.get(capabilityName)
	if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) return null
	return groupId
}

export async function getSparkCapabilityGroupId(peer, spark, capabilityName) {
	const osId = await getSparkOsId(peer, spark)
	return getCapabilityGroupIdFromOsId(peer, osId, capabilityName)
}

/**
 * Get capability group co-id for a spark by spark co-id (not spark name)
 * @param {Object} peer - Backend instance
 * @param {string} sparkCoId - Spark CoMap co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
export async function getSparkCapabilityGroupIdFromSparkCoId(peer, sparkCoId, capabilityName) {
	if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) return null
	const sparkCore = peer.getCoValue(sparkCoId) || (await peer.node?.loadCoValueCore?.(sparkCoId))
	if (!sparkCore || !peer.isAvailable?.(sparkCore)) return null
	const sparkContent = peer.getCurrentContent?.(sparkCore)
	if (!sparkContent || typeof sparkContent.get !== 'function') return null
	const osId = sparkContent.get('os')
	return getCapabilityGroupIdFromOsId(peer, osId, capabilityName)
}

/**
 * Get guardian (admin-role) group for a spark by name
 * Resolves from spark.os.capabilities.guardian only (no spark.group; fresh DB).
 * @param {Object} peer - Backend instance with read(), getCoValue(), getCurrentContent(), account
 * @param {string} spark - Spark name (e.g. "°Maia", "@handle")
 * @returns {Promise<RawGroup|null>} Group for the spark or null
 */
export async function getSparkGroup(peer, spark) {
	if (!spark || typeof spark !== 'string') {
		throw new Error('[getSparkGroup] spark is required')
	}
	const cacheKey = `_cachedSparkGroup_${spark}`
	if (peer[cacheKey]) {
		return peer[cacheKey]
	}
	const groupId = await getSparkCapabilityGroupId(peer, spark, 'guardian')
	if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) {
		throw new Error(`[getSparkGroup] Spark ${spark} has no guardian in os.capabilities`)
	}
	const groupStore = await peer.read('@group', groupId)
	if (!groupStore || groupStore.value?.error) {
		throw new Error(`[getSparkGroup] Group for spark ${spark} not available: ${groupId}`)
	}
	await waitForStoreReady(groupStore, groupId, 10000)
	const groupCore = peer.getCoValue(groupId)
	if (!groupCore) {
		throw new Error(`[getSparkGroup] Group core not found: ${groupId}`)
	}
	const group = peer.getCurrentContent(groupCore)
	if (!group || typeof group.createMap !== 'function') {
		throw new Error(`[getSparkGroup] Group content not available: ${groupId}`)
	}
	peer[cacheKey] = group
	return group
}

/**
 * Load account.registries → registries.sparks CoMap content for spark resolution.
 * @param {Object} peer
 * @returns {Promise<{get(key: string): string|undefined}|null>} Sparks registry content or null
 */
/** Get sparks registry CoMap co-id (account.registries.sparks). Returns null if not found. */
export async function getSparksRegistryId(peer) {
	const registriesId = peer.account?.get?.('registries')
	if (!registriesId?.startsWith('co_z')) return null
	const registriesStore = await peer.read(null, registriesId)
	await waitForStoreReady(registriesStore, registriesId, 10000)
	const registriesContent = registriesStore?.value ?? {}
	return registriesContent.sparks ?? null
}

/** Get humans registry CoMap co-id (account.registries.humans). Returns null if not found. */
export async function getHumansRegistryId(peer) {
	const registriesId = peer.account?.get?.('registries')
	if (!registriesId?.startsWith('co_z')) return null
	const registriesStore = await peer.read(null, registriesId)
	await waitForStoreReady(registriesStore, registriesId, 10000)
	const registriesContent = registriesStore?.value ?? {}
	return registriesContent.humans ?? null
}

export async function getSparksRegistryContent(peer) {
	const sparksId = await getSparksRegistryId(peer)
	if (!sparksId?.startsWith('co_z')) return null
	const sparksStore = await peer.read(null, sparksId)
	await waitForStoreReady(sparksStore, sparksId, 10000)
	const sparksContent = sparksStore?.value ?? {}
	return {
		get(key) {
			const v = sparksContent[key]
			return typeof v === 'string' && v.startsWith('co_z') ? v : undefined
		},
	}
}

/** Resolve spark key to spark co-id (from registries or use co-id directly). */
export async function resolveSparkCoId(peer, spark) {
	if (!spark || typeof spark !== 'string') return null
	if (spark.startsWith('co_z')) return spark
	const sparks = await getSparksRegistryContent(peer)
	if (!sparks) return null
	return sparks.get(spark) ?? null
}

/**
 * Get spark's os CoMap id (account.registries.sparks[spark].os)
 * @param {Object} peer
 * @param {string} spark - Spark name (e.g. "°Maia") or spark co-id
 * @returns {Promise<string|null>}
 */
export async function getSparkOsId(peer, spark) {
	const sparkCoId = await resolveSparkCoId(peer, spark)
	if (!sparkCoId?.startsWith('co_z')) return null
	const sparkStore = await peer.read(null, sparkCoId)
	await waitForStoreReady(sparkStore, sparkCoId, 10000)
	const sparkData = sparkStore?.value ?? {}
	const osId = sparkData.os || null
	if (osId) peer._cachedMaiaOsId = osId
	return osId
}

/**
 * Get spark's agents CoMap id (account.registries.sparks[spark].agents)
 * @param {Object} peer
 * @param {string} spark
 * @returns {Promise<string|null>}
 */
export async function getSparkAgentsId(peer, spark) {
	const sparkCoId = await resolveSparkCoId(peer, spark)
	if (!sparkCoId?.startsWith('co_z')) return null
	const sparkStore = await peer.read(null, sparkCoId)
	await waitForStoreReady(sparkStore, sparkCoId, 10000)
	const sparkData = sparkStore?.value ?? {}
	return sparkData.agents ?? null
}

/**
 * Set spark's agents CoMap id
 * @param {Object} peer
 * @param {string} spark
 * @param {string} agentsId
 */
export async function setSparkAgentsId(peer, spark, agentsId) {
	const sparkCoId = await resolveSparkCoId(peer, spark)
	if (!sparkCoId?.startsWith('co_z'))
		throw new Error(`[setSparkAgentsId] Spark ${spark} not found in registries`)
	const sparkCore = peer.getCoValue(sparkCoId)
	if (!sparkCore) throw new Error(`[setSparkAgentsId] Spark core not found: ${sparkCoId}`)
	const sparkContent = peer.getCurrentContent(sparkCore)
	if (!sparkContent || typeof sparkContent.set !== 'function')
		throw new Error(`[setSparkAgentsId] Spark content not available`)
	sparkContent.set('agents', agentsId)
}

/**
 * Get °Maia spark's group (for create operations, seeding, etc.)
 * @param {Object} peer - Backend instance
 * @returns {Promise<RawGroup|null>} °Maia spark's group
 */
export async function getMaiaGroup(peer) {
	return getSparkGroup(peer, '°Maia')
}

/**
 * Extract account members from a group with their effective roles
 * Uses roleOf() to get effective roles including inherited roles from group members
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string, isInherited?: boolean}>} Array of account members with effective roles
 */
export function extractAccountMembers(groupContent) {
	const accountMembers = []
	const seenMembers = new Set()

	try {
		// Method 1: Get direct members using getMemberKeys() (more reliable)
		if (typeof groupContent.getMemberKeys === 'function') {
			const memberKeys = groupContent.getMemberKeys()
			for (const memberId of memberKeys) {
				if (seenMembers.has(memberId)) continue
				seenMembers.add(memberId)

				// Get effective role using roleOf() - this includes inherited roles from group members
				let role = null
				if (typeof groupContent.roleOf === 'function') {
					try {
						role = groupContent.roleOf(memberId)
					} catch (_e) {
						// Fallback to direct get
						try {
							const directRole = groupContent.get(memberId)
							if (directRole && directRole !== 'revoked') {
								role = directRole
							}
						} catch (_e2) {
							// Ignore
						}
					}
				} else if (typeof groupContent.get === 'function') {
					// Fallback: use direct get if roleOf not available
					const directRole = groupContent.get(memberId)
					if (directRole && directRole !== 'revoked') {
						role = directRole
					}
				}

				if (role && role !== 'revoked') {
					// Check if this is a direct role or inherited (from parent group)
					const directRole = groupContent.get ? groupContent.get(memberId) : null
					// When direct is revoked, role comes from parent → inherited. When direct !== role, inherited.
					const isInherited = directRole === 'revoked' || directRole !== role

					accountMembers.push({
						id: memberId,
						role: role,
						isInherited: isInherited || false,
					})
				}
			}
		}

		// Method 2: Fallback - try members iterator (legacy support)
		if (
			accountMembers.length === 0 &&
			groupContent.members &&
			typeof groupContent.members[Symbol.iterator] === 'function'
		) {
			for (const member of groupContent.members) {
				if (member?.account) {
					const accountRef = member.account
					const memberId =
						typeof accountRef === 'string'
							? accountRef
							: accountRef.id || accountRef.$jazz?.id || 'unknown'

					if (seenMembers.has(memberId)) continue
					seenMembers.add(memberId)

					let role = null
					if (typeof groupContent.roleOf === 'function') {
						try {
							role = groupContent.roleOf(memberId)
						} catch (_e) {
							// Ignore
						}
					}

					if (role && role !== 'revoked') {
						accountMembers.push({
							id: memberId,
							role: role,
							isInherited: false,
						})
					}
				}
			}
		}
	} catch (_e) {}
	return accountMembers
}

/**
 * Extract "everyone" role from a group
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {string|null} Everyone role or null if not found
 */
export function extractEveryoneRole(groupContent) {
	try {
		let everyoneRole = null

		if (typeof groupContent.getRoleOf === 'function') {
			try {
				const role = groupContent.getRoleOf('everyone')
				if (role && typeof role === 'string' && role !== 'revoked') {
					everyoneRole = role
				}
			} catch (_e) {
				// Ignore
			}
		}

		if (!everyoneRole && typeof groupContent.get === 'function') {
			try {
				const value = groupContent.get('everyone')
				if (value && typeof value === 'string' && value !== 'revoked') {
					everyoneRole = value
				}
			} catch (_e) {
				// Ignore
			}
		}

		if (!everyoneRole && groupContent.everyone !== undefined) {
			const value = groupContent.everyone
			if (value && typeof value === 'string' && value !== 'revoked') {
				everyoneRole = value
			}
		}

		return everyoneRole
	} catch (_e) {
		return null
	}
}

/**
 * Extract group members (groups added via addGroupMember) from a group with their delegation roles
 *
 * GROUP-IN-GROUP ACCESS:
 * A group can have other groups as members (addGroupMember(group, role)). Members of those groups
 * get access to this group's co-values according to the delegation role.
 *
 * Delegation roles: "extend" (inherits each member's role), "reader", "writer", "manager", "admin", "revoked".
 *
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string, roleDescription: string, members: Array<{id: string, role: string}>}>} Group members with delegation roles and their members
 */
export function extractGroupMembers(groupContent) {
	const groupMembers = []
	try {
		if (typeof groupContent.getParentGroups === 'function') {
			const parentGroups = groupContent.getParentGroups()
			if (parentGroups && typeof parentGroups[Symbol.iterator] === 'function') {
				for (const parentGroup of parentGroups) {
					const parentId =
						typeof parentGroup === 'string'
							? parentGroup
							: parentGroup.id || parentGroup.$jazz?.id || 'unknown'

					// Get the delegation role from the group
					// Parent groups are stored as "parent_{groupId}" keys
					let delegationRole = null
					const parentKey = `parent_${parentId}`

					if (typeof groupContent.get === 'function') {
						try {
							delegationRole = groupContent.get(parentKey)
						} catch (_e) {
							// Ignore
						}
					}

					// Map delegation role to description (user-facing: no "parent"/"extend" wording; use "group member" vocabulary)
					let roleDescription = ''
					if (delegationRole === 'extend') {
						roleDescription = 'Inherits roles from this group'
					} else if (delegationRole === 'reader') {
						roleDescription = 'All members of this group get reader access'
					} else if (delegationRole === 'writer') {
						roleDescription = 'All members of this group get writer access'
					} else if (delegationRole === 'manager') {
						roleDescription = 'All members of this group get manager access'
					} else if (delegationRole === 'admin') {
						roleDescription = 'All members of this group get admin access'
					} else if (delegationRole === 'revoked') {
						roleDescription = 'Delegation revoked'
					} else {
						roleDescription = 'Delegated access'
					}

					// Get actual members of this group member and their effective role here
					const delegatedMembers = []
					try {
						const memberKeys =
							typeof parentGroup.getMemberKeys === 'function' ? parentGroup.getMemberKeys() : []
						const hasEveryone = typeof parentGroup.get === 'function' && parentGroup.get('everyone')
						const memberIds = [...memberKeys]
						if (hasEveryone) memberIds.push('everyone')
						for (const memberId of memberIds) {
							const parentRole =
								typeof parentGroup.roleOf === 'function' ? parentGroup.roleOf(memberId) : null
							if (!parentRole || parentRole === 'revoked') continue
							const effectiveRole =
								delegationRole === 'extend' || delegationRole === 'inherit' ? parentRole : delegationRole
							delegatedMembers.push({ id: memberId, role: effectiveRole })
						}
					} catch (_e) {
						// Group member may not be fully loaded - skip members
					}

					groupMembers.push({
						id: parentId,
						role: delegationRole || 'extend',
						roleDescription: roleDescription,
						members: delegatedMembers,
					})
				}
			}
		}
	} catch (_e) {}
	return groupMembers
}

/**
 * Get group info from a RawGroup
 * @param {RawGroup} group - RawGroup instance
 * @returns {Object|null} Group info object or null if invalid
 */
export function getGroupInfoFromGroup(group) {
	if (!group || typeof group.addMember !== 'function') {
		return null
	}

	try {
		const groupId = group.id || group.$jazz?.id
		if (!groupId) {
			return null
		}

		const accountMembers = extractAccountMembers(group)

		const everyoneRole = extractEveryoneRole(group)
		if (everyoneRole) {
			const everyoneExists = accountMembers.some((m) => m.id === 'everyone')
			if (!everyoneExists) {
				accountMembers.push({
					id: 'everyone',
					role: everyoneRole,
				})
			}
		}

		const groupMembers = extractGroupMembers(group)

		return {
			groupId: groupId,
			accountMembers: accountMembers,
			groupMembers: groupMembers,
		}
	} catch (_error) {
		return null
	}
}

/**
 * Add a member to a group. Accepts account co-id only; agent ID is resolved internally (never exposed).
 * Sealer/signer and PEER_SECRET are private - never accept, log, or expose agent IDs.
 * Stores account co-id (co_z) as the group member key so resolveAccountCoIdsToProfileNames works.
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} accountCoId - Account co-id (co_z...) - REQUIRED
 * @param {string} role - Role name
 * @param {Object} [peer] - Optional peer (for ensureCoValueLoaded)
 * @returns {Promise<void>}
 */
export async function addGroupMember(node, group, accountCoId, role, peer = null) {
	if (typeof group.addMember !== 'function') {
		throw new Error('[MaiaDB] Group does not support addMember')
	}

	if (!accountCoId || !accountCoId.startsWith('co_z')) {
		throw new Error(
			'[MaiaDB] accountCoId required (co_z...). Human must sign in from maia first so account syncs.',
		)
	}

	if (peer) {
		const { ensureCoValueLoaded } = await import('../crud/collection-helpers.js')
		await ensureCoValueLoaded(peer, accountCoId, { waitForAvailable: true, timeoutMs: 10000 })
	}
	const accountCore = node.expectCoValueLoaded(
		accountCoId,
		'Expected account loaded. Human must sign in from maia at least once so account syncs.',
	)
	const accountContent = accountCore.getCurrentContent()
	// Resolve to agent ID internally only - never expose, log, or accept agent ID as input
	let agentId = null
	if (typeof accountContent?.currentAgentID === 'function') {
		agentId = accountContent.currentAgentID()
	} else if (accountCore.verified?.header?.ruleset?.type === 'group') {
		const raw = accountCore.verified.header.ruleset.initialAdmin
		if (typeof raw === 'string' && raw.startsWith('sealer_') && raw.includes('/signer_')) {
			agentId = raw
		}
	}
	if (!agentId) {
		throw new Error(
			'[addGroupMember] Could not resolve agent ID from account. Human must sign in from maia at least once.',
		)
	}
	// Pass account-like object so CoJSON stores account co-id (co_z), not agent ID (sealer_z)
	const accountLike = { id: accountCoId, currentAgentID: () => agentId }
	group.addMember(accountLike, role)
}

/**
 * Check if removing memberId would leave the group with no admins
 * @param {RawGroup} groupContent - Group content
 * @param {string} memberIdToRemove - Member co-id to remove
 * @returns {boolean} True if removing would leave no admins
 */
export function wouldLeaveNoAdmins(groupContent, memberIdToRemove) {
	const accountMembers = extractAccountMembers(groupContent)
	const directAdmins = accountMembers.filter(
		(m) => (m.role === 'admin' || m.role === 'manager') && m.id !== memberIdToRemove,
	)
	if (directAdmins.length > 0) return false

	const groupMembers = extractGroupMembers(groupContent)
	// Parent with admin/extend role provides admin coverage (its members get delegated)
	// Note: getMemberKeys may not exist on all CoJSON group types, so we allow remove when any parent has admin/extend
	const hasParentWithAdmins = groupMembers.some((g) => g.role === 'admin' || g.role === 'extend')
	if (hasParentWithAdmins) return false

	return true
}

/**
 * Remove a member from a group
 * Rejects if removing would leave the group with no admins
 * @param {RawGroup} group - Group CoValue
 * @param {string|Object} member - Member co-id (co_z...) or account content with .id
 * @returns {Promise<void>}
 */
export async function removeGroupMember(group, member) {
	const memberId = typeof member === 'string' ? member : (member?.id ?? member?.$jazz?.id)
	if (!memberId || !memberId.startsWith('co_z')) {
		throw new Error('[removeGroupMember] member must be co-id (co_z...) or account content with .id')
	}
	if (typeof group.removeMember !== 'function') {
		throw new Error('[MaiaDB] Group does not support removeMember')
	}
	if (wouldLeaveNoAdmins(group, memberId)) {
		throw new Error(
			'[removeGroupMember] Cannot remove last admin. Group must have at least one admin.',
		)
	}
	group.removeMember(memberId)
}

/**
 * Set a member's role in a group
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID
 * @param {string} role - New role name
 * @returns {Promise<void>}
 */
export async function setGroupMemberRole(node, group, memberId, role) {
	if (typeof group.setRole === 'function') {
		group.setRole(memberId, role)
	} else if (typeof group.removeMember === 'function' && typeof group.addMember === 'function') {
		group.removeMember(memberId)
		await addGroupMember(node, group, memberId, role, null)
	} else {
		throw new Error('[MaiaDB] Group does not support role changes')
	}
}
