import { getAuthDb } from "$lib/db.server";

export interface UserInfo {
	id: string;
	name: string | null;
	email: string | null;
	image: string | null;
}

/**
 * Get user information by user ID from BetterAuth user table
 */
export async function getUserInfo(userId: string): Promise<UserInfo | null> {
	try {
		const db = getAuthDb();
		
		// BetterAuth uses 'user' table
		const user = await db
			.selectFrom('user')
			.select(['id', 'name', 'email', 'image'])
			.where('id', '=', userId)
			.executeTakeFirst();
		
		if (!user) {
			return null;
		}
		
		return {
			id: user.id,
			name: user.name || null,
			email: user.email || null,
			image: user.image || null,
		};
	} catch (error) {
		console.error('[user-helpers] Error fetching user info:', error);
		return null;
	}
}

/**
 * Get user information for multiple user IDs
 */
export async function getUserInfoBatch(userIds: string[]): Promise<Map<string, UserInfo>> {
	const userMap = new Map<string, UserInfo>();
	
	if (userIds.length === 0) {
		return userMap;
	}
	
	try {
		const db = getAuthDb();
		
		const users = await db
			.selectFrom('user')
			.select(['id', 'name', 'email', 'image'])
			.where('id', 'in', userIds)
			.execute();
		
		for (const user of users) {
			userMap.set(user.id, {
				id: user.id,
				name: user.name || null,
				email: user.email || null,
				image: user.image || null,
			});
		}
	} catch (error) {
		console.error('[user-helpers] Error fetching user info batch:', error);
	}
	
	return userMap;
}






