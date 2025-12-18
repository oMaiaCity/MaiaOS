import { Group, co } from "jazz-tools";

/**
 * Wallet account schema matching the working Jazz starter pattern
 */

// Profile is public (visible to everyone)
// co.profile() already includes name, inbox, and inboxInvite fields
export const WalletProfile = co.profile();

// Root is private (only accessible by the account owner)
export const WalletAccountRoot = co.map({
  // Add private fields here if needed
});

export const WalletAccount = co
  .account({
    profile: WalletProfile,
    root: WalletAccountRoot,
  })
  .withMigration(async (account) => {
    // Set up account root on first login (matches working starter)
    if (!account.$jazz.has('root')) {
      account.$jazz.set('root', {});
    }

    // Set up profile on first login (matches working starter)
    if (!account.$jazz.has('profile')) {
      const group = Group.create();
      group.addMember('everyone', 'reader'); // Profile is visible to everyone
      
      account.$jazz.set(
        'profile',
        WalletProfile.create(
          {
            name: '',
          },
          group,
        ),
      );
    }
  });

