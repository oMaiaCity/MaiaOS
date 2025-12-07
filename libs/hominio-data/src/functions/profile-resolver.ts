/**
 * Profile Resolver
 * Resolves profile CoMap from a user ID (account ID)
 * 
 * For now, can only resolve me.profile.name (current user's profile)
 * Future: Will be able to resolve any user's profile if we have access
 */

/**
 * Resolve profile information from a user ID
 * 
 * @param userId - The account ID (CoID) to resolve profile for
 * @param currentAccount - The current Jazz account (for accessing me.profile)
 * @returns Profile info with name and image, or null if not resolvable
 */
export function resolveProfile(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentAccount?: any
): { name: string | null; image: any | null } | null {
  // For now, only resolve if it's the current user's account
  // Check if userId matches currentAccount's ID
  if (!currentAccount || !currentAccount.$jazz || !currentAccount.profile) {
    return null;
  }

  const currentAccountId = currentAccount.$jazz.id;
  if (userId !== currentAccountId) {
    // Can't resolve other users' profiles yet
    return null;
  }

  // It's the current user, resolve from me.profile
  const profile = currentAccount.profile;
  if (!profile || !profile.$isLoaded) {
    return null;
  }

  const profileAny = profile as any;
  
  // Get name (computed field)
  const name = profileAny.name || null;
  
  // Get image if available
  let image = null;
  if (profileAny.$jazz && typeof profileAny.$jazz.has === "function" && profileAny.$jazz.has("image")) {
    const imageValue = profileAny.image;
    if (imageValue && imageValue.$isLoaded) {
      image = imageValue;
    }
  }

  return {
    name: name && typeof name === "string" ? name.trim() : null,
    image,
  };
}


