# Milestone 0: The Waitlist (Pre-Launch)

## Vision
Before the game begins, we build the foundation. A beautiful, minimal waitlist that establishes identity, gathers a community, and prepares for launch. Invite-only from day one.

## Core Experience

### The Journey

**Alice discovers maia.city:**
- Minimal, elegant landing page
- Clear message: "The future city simulation. Invite only."
- Single call-to-action: "Join Waitlist"

**Alice joins:**
- Click "Join Waitlist"
- Glassmorphic signup card appears
- Enter name: "Alice"
- Create passkey (WebAuthn)
- Accept privacy policy
- Account created

**Alice subscribes to updates:**
- Notification prompt appears immediately after signup
- "Get notified when your invite is ready"
- "Daily progress updates on our journey to launch"
- Click "Subscribe" → Web push permission prompt
- Subscribed

**Alice reserves her agent twin (1€ waitlist fee):**
- Payment card appears immediately after notification subscription
- **Two-step process:**
  1. Choose agent twin username (e.g., "alice")
  2. Pay 1€ to reserve it
- **Urgency messaging:**
  - "Reserve your agent twin: @alice"
  - "246 citizens ahead of you"
  - "1€ reserves your spot + your unique agent identity"
  - Real-time counter: "1,247 total citizens registered"
  - Username availability: "✓ @alice is available"
- Simple payment form (Creem.io MoR)
- One-time 1€ charge
- Payment confirms → Username reserved + Spot secured

**Alice sees her dashboard:**
- Confirmation screen: "Your identity is secured!"
- Agent Twin: "@alice" (reserved)
- Position: "#247 in queue"
- Status: "✓ Paid - Spot Reserved"
- Estimated invite: "~3 weeks"
- Urgency reminder: "246 citizens ahead of you"
- What happens next:
  - Daily notifications with progress updates
  - Final notification when invite is ready
  - Your @alice identity awaits in MaiaCity

**Alice receives daily updates:**
- Each day at 9am: Push notification
- "Day 12: 1,247 citizens waiting. 89 invites sent. Game development at 34%."
- Keeps engagement high
- Builds anticipation

**Alice gets invited:**
- Push notification: "Your MaiaCity invite is ready!"
- Click → Opens maia.city
- Passkey login (already set up)
- Enters Milestone 1 (3D world with tent)

## Technical Specification

### 1. Landing Page (Minimal)

**Design:**
- Fullscreen hero section
- Background: Subtle animated gradient or abstract city silhouette
- Center content:
  - Logo/wordmark: "MaiaCity"
  - Tagline: "Own the future. Build it together."
  - Subtitle: "A simulation game where 1.3M citizens co-create Earth's new capital."
  - Button: "Join Waitlist" (large, prominent, glassmorphic)
- Footer:
  - Links: Privacy Policy, About, Contact
  - Social: Twitter/X, Discord (if available)

**No navigation.** No complexity. Just the message and the button.

**Tech stack:**
- MaiaOS framework (JSON-based, `.maia` files)
- Runtime-based (no build process)
- Pure declarative definitions (actors, views, states, styles)
- Minimal JavaScript (kernel only)
- Deployed to maia.city

### 2. Jazz Local-First Architecture

**What is Jazz?**
Jazz (jazz.tools) is a local-first database framework. Data lives on the user's device first, syncs to cloud automatically. Enables:
- Instant interactions (no loading spinners)
- Offline-first functionality
- Real-time multiplayer (built-in)
- End-to-end encryption (optional)
- Simple API (reactive, declarative)

**Account system:**
Jazz handles accounts natively. Each user gets:
- Cryptographic identity (key pair)
- Account object (stored locally + synced)
- Automatic sync to Jazz cloud service

**Data structures needed:**
- **WaitlistUser**: Stores user account data (ID, name, position, payment status, username, push subscription)
- **WaitlistState**: Global waitlist metrics (total users, invites sent, game progress, daily growth)
- **UsernameRegistry**: Tracks reserved usernames to prevent duplicates
- **PrivacyAcceptance**: Log of privacy policy acceptances (compliance)
- **Payment**: Payment transaction records (analytics)

**Jazz cloud connection:**
- Sign up at jazz.tools for cloud service
- Get API credentials
- Configure environment variables for cloud URL, app ID, and secret

**Benefits:**
- Users can close browser, return later → data still there
- No database setup needed for Milestone 0
- Scales to Milestone 1+ seamlessly (multiplayer built-in)
- Simple developer experience

### 3. Passkey Authentication (WebAuthn)

**Flow:**
1. User enters name: "Alice"
2. Click "Create Passkey"
3. Browser shows WebAuthn prompt:
   - Touch ID (Mac)
   - Face ID (iPhone)
   - Fingerprint (Android)
   - Security key (Yubikey)
4. Credential created and stored locally
5. User ID generated
6. Jazz account created with passkey as auth


**Jazz integration:**
Jazz accounts use cryptographic keys. Passkey credential can be used as the signing key, or linked to Jazz account.

**No passwords.** No email. Just passkey.

### 4. Privacy Policy

**Requirements:**
- GDPR compliant
- Clear data usage explanation
- User consent before account creation

**Content (minimal):**
- **Data we collect:** Name, passkey credential, push subscription, waitlist position
- **Why:** To manage waitlist, send notifications, provide game access
- **Storage:** Local-first (Jazz), synced to Jazz cloud service
- **Sharing:** We don't share data with third parties
- **Your rights:** Access, delete, export your data anytime
- **Contact:** privacy@maia.city

**UI:**
- Modal or dedicated page at `/privacy`
- Checkbox during signup: "I accept the privacy policy"
- Must be checked before creating passkey
- Link to full policy
- State machine handles checkbox toggle and validation

### 5. Web Push Notifications

**Why:**
- Keep waitlist engaged during development
- Daily progress updates build anticipation
- Notify when invite is ready
- Re-engagement channel

**Service worker requirements:**
- Handle push events to display notifications
- Handle notification clicks to open maia.city
- Register service worker after passkey signup
- Request notification permission from user
- Subscribe to push notifications using VAPID keys
- Save subscription object to user's Jazz account

**Notification prompt (glassmorphic card):**
After passkey creation succeeds, immediately show:

```
┌─────────────────────────────────────────┐
│  Stay Updated                           │
│                                         │
│  Get notified when:                     │
│  • Your invite is ready                 │
│  • Daily progress updates               │
│                                         │
│  [Subscribe to Notifications]           │
│  [Maybe Later]                          │
└─────────────────────────────────────────┘
```

**Backend (sending notifications):**
We need a simple backend service to send push notifications. Options:
- Cloudflare Workers (serverless)
- Deno Deploy (serverless)
- Simple Node.js server

**Requirements:**
- Configure VAPID keys for web push
- Daily cron job (9am) to send progress updates
- Fetch all users with push subscriptions from Jazz
- Send notification payload with waitlist stats
- Handle notification delivery failures gracefully

### 6. Payment Integration (1€ Waitlist Fee via Creem.io)

**Why Creem.io as Merchant of Record (MoR)?**
- Handles all global tax compliance (VAT, sales tax, 100+ countries)
- We get full liability protection
- 3.9% + 40¢ flat fee (no hidden costs)
- Beautiful checkout experience
- Webhooks that just work
- Built for developers

**What does 1€ buy?**
1. **Waitlist spot reservation** (priority over unpaid signups)
2. **Agent twin username** (@alice) - your unique identity in MaiaCity
3. **Early supporter status** (visible in-game later)

**Why this is genius:**
- Validates real interest (commitment signal)
- Filters out non-serious signups
- Creates urgency and scarcity
- Generates early revenue
- **Username reservation adds tangible value** (identity is valuable)
- Spot + identity feels worth way more than 1€

**Username reservation flow:**
1. After notification subscription succeeds, show username selection card
2. Pre-fill username from signup name (lowercase)
3. Real-time validation: Check against UsernameRegistry in Jazz
4. Show availability status (available/taken)
5. After username confirmed, show payment card with urgency messaging
6. Create Creem.io checkout session with username and user metadata
7. Redirect user to Creem checkout page

**Creem.io setup:**
- Create product in Creem dashboard: "MaiaCity Waitlist Spot"
- Set price: 1€ one-time payment
- Configure webhook endpoint to receive payment events
- Handle checkout.completed and payment.received events

**Username + Payment card design (glassmorphic):**
```
┌─────────────────────────────────────────┐
│  Reserve Your Agent Twin                │
│                                         │
│  Choose your identity:                  │
│  @[alice____________]                   │
│  ✓ @alice is available                  │
│                                         │
│  💡 Your agent twin is your AI alter    │
│     ego in MaiaCity. Choose wisely.     │
│                                         │
│  [Continue]                             │
└─────────────────────────────────────────┘

↓ (After username confirmed)

┌─────────────────────────────────────────┐
│  Secure Your Identity                   │
│                                         │
│  🤖 Agent Twin: @alice                  │
│                                         │
│  ⚡ 246 citizens ahead of you           │
│  👥 1,247 total citizens registered     │
│                                         │
│  1€ reserves:                           │
│  • Your waitlist spot (#247)            │
│  • Your @alice identity (permanent)     │
│  • Early supporter status               │
│                                         │
│  [Reserve @alice (1€)]                  │
│  [Maybe Later]                          │
│                                         │
│  🛡️ Powered by Creem (MoR)             │
└─────────────────────────────────────────┘
```

**Creem webhook handling:**
- Verify webhook signature for security
- On checkout.completed event:
  - Extract user_id, username, position from metadata
  - Update user in Jazz: mark as paid, set username, store checkout ID
  - Reserve username in UsernameRegistry (status: "reserved")
  - Send confirmation push notification to user

### 7. User Flow Architecture

```
[User visits maia.city]
    ↓
[Landing page loads (minimal, beautiful)]
    ↓
[Clicks "Join Waitlist"]
    ↓
[Glassmorphic signup card overlays]
    ↓
[Enter name: "Alice"]
    ↓
[Checkbox: Accept privacy policy]
    ↓
[Button: "Create Passkey"]
    ↓
[WebAuthn prompt (Touch ID, etc.)]
    ↓
[Passkey created → Jazz account created]
    ↓
[Notification prompt card appears]
    ↓
[User clicks "Subscribe to Notifications"]
    ↓
[Browser permission prompt]
    ↓
[Permission granted → Subscription saved]
    ↓
[Username selection card appears]
  - "Reserve Your Agent Twin"
  - Input: "@alice"
  - Real-time validation: "✓ @alice is available"
    ↓
[User confirms username]
    ↓
[Payment card appears]
  - "Secure Your Identity"
  - "🤖 Agent Twin: @alice"
  - "246 citizens ahead of you"
  - "1€ reserves your spot + @alice identity"
    ↓
[User clicks "Reserve @alice (1€)"]
    ↓
[Creem.io Checkout opens]
    ↓
[User pays 1€]
    ↓
[Payment succeeds → Username reserved → Redirect to confirmation]
    ↓
[Confirmation screen]
  - "Your identity is secured! ✓"
  - "🤖 Agent Twin: @alice"
  - Position: #247
  - Status: "Paid - Identity Reserved"
  - Estimated invite: ~3 weeks
  - "@alice will be activated when you enter MaiaCity"
    ↓
[User closes browser]
    ↓
[Daily notifications arrive (9am each day)]
    ↓
[After N days: Invite notification arrives]
    ↓
[User clicks notification → Opens maia.city]
    ↓
[Passkey login (automatic/seamless)]
    ↓
[Account marked as invited]
    ↓
[Redirect to Milestone 1 (3D world)]
```

### 8. Returning User Flow

**User visits maia.city again:**
- Jazz auto-loads their account (local-first)
- No login needed (already authenticated via passkey)
- See updated waitlist position with urgency
- See payment status
- See countdown to invite

**If user hasn't paid yet:**
- Dashboard shows payment prompt with updated urgency
- "Complete your reservation - 1€"
- Updated position: "Now 312 citizens ahead of you (was 246)"
- Creates FOMO (position is moving, others are joining)

**If passkey expired/lost:**
- Option to create new passkey
- Same Jazz account, new credential

**Dashboard view (after signup + payment):**
```
┌─────────────────────────────────────────┐
│  Welcome back, Alice                    │
│                                         │
│  🤖 Agent Twin: @alice (reserved)       │
│  ✓ Identity Secured                     │
│                                         │
│  Your Position: #247                    │
│  🔥 246 citizens ahead of you           │
│  Total Waitlist: 1,247 citizens         │
│                                         │
│  Estimated Invite: ~18 days             │
│                                         │
│  Progress:                              │
│  • Game Development: 34% ███████░░░░░   │
│  • Invites Sent: 89                     │
│  • You're in batch #3 (5-8 players)     │
│                                         │
│  Urgency Indicator:                     │
│  🟢 +127 joined today                   │
│  📈 Waitlist growing 8%/week            │
│                                         │
│  💡 Your @alice identity will be        │
│     activated when you receive your     │
│     invite to enter MaiaCity            │
│                                         │
│  [Share Invite Link] (future: referrals)│
└─────────────────────────────────────────┘
```

**Dashboard view (unpaid user - urgency):**
```
┌─────────────────────────────────────────┐
│  Welcome back, Alice                    │
│                                         │
│  ⚠️ Complete Your Reservation           │
│  Your Position: #247 (provisional)      │
│  🔥 246 citizens ahead of you           │
│  Total Paid: 1,089 citizens secured     │
│                                         │
│  🤖 @alice is still available!          │
│     But not for long...                 │
│                                         │
│  ⚡ +127 citizens joined today          │
│  ⚡ +58 citizens paid today             │
│  ⚡ +23 usernames reserved in last hour │
│                                         │
│  [Reserve @alice (1€)] ← PRIMARY CTA    │
│                                         │
│  💡 1€ gets you:                        │
│  • Guaranteed waitlist spot (#247)      │
│  • @alice username (permanent)          │
│  • Priority over unpaid signups         │
│  • Early supporter status               │
└─────────────────────────────────────────┘
```

## MaiaOS Architecture

### File Structure
```
maia.city/
├── o/kernel.js                    # MaiaOS kernel (single entry point)
├── waitlist.actor.maia            # Main waitlist actor
├── waitlist.view.maia             # UI structure (glassmorphic cards)
├── waitlist.state.maia            # State machine (signup flow)
├── waitlist.context.maia           # Runtime data (user, position)
├── waitlist.style.maia            # Glassmorphic styling
├── passkey.tool.maia              # WebAuthn tool definition
├── creem.tool.maia                # Creem.io payment tool
├── jazz.tool.maia                 # Jazz database tool
├── push.tool.maia                 # Web push notification tool
└── sw.js                          # Service worker (for push)
```

### Actor Definition
- Main waitlist actor references context, state, view, and style
- Integrates tools: passkey, creem, jazz, push

### State Machine Flow
- **landing** → User clicks "Join Waitlist" → **signup**
- **signup** → User enters name → **privacy**
- **privacy** → User accepts policy → **passkey**
- **passkey** → Passkey created successfully → **notifications**
- **notifications** → User subscribes or skips → **username**
- **username** → User selects username → **payment**
- **payment** → Payment succeeds → **confirmed** (final state)

### Tools Integration
- **passkey.tool.maia**: WebAuthn registration/login
- **creem.tool.maia**: Creem.io checkout creation + webhook handling
- **jazz.tool.maia**: Local-first database operations (create user, update position)
- **push.tool.maia**: Web push subscription management

## Database Schema (Jazz)

**WaitlistUser:**
- User account data: ID, name, username, passkey ID, created timestamp
- Queue position, invitation status
- Push subscription object
- Payment status (paid boolean, payment timestamp, Creem checkout ID, amount)
- Last seen timestamp (analytics)

**UsernameRegistry:**
- Global registry to prevent duplicate usernames
- Maps username to user_id, reserved_at timestamp, and status ("reserved" or "active")

**WaitlistState:**
- Global metrics: total users, total paid users, invites sent
- Game progress percentage, days since launch
- Daily growth tracking: signups today, payments today, weekly growth rate
- Next invite batch timestamp

**PrivacyAcceptance:**
- Compliance log: user_id, acceptance timestamp, policy version, IP address

**Payment:**
- Transaction records: ID, user_id, username, amount (cents), currency
- Creem checkout ID, payment status, timestamps

## Visual Design

### Landing Page
- **Hero background:** Animated gradient (blue/purple tones) or abstract city wireframe
- **Typography:** Large, bold, modern sans-serif
- **Button:** Glassmorphic, large (min 160px wide, 56px tall)
- **Spacing:** Generous, minimal content
- **Mobile-first:** Works beautifully on all devices

### Signup Card (Glassmorphic)
- Translucent background (10% opacity white)
- Backdrop blur effect (10px)
- Subtle border (20% opacity white)
- Rounded corners (16px)
- Generous padding (32px)
- Max width 420px for readability
- Soft shadow for depth

### Notification Prompt
- Appears immediately after signup
- Same glassmorphic styling
- Clear value proposition
- Two buttons: Primary (Subscribe) + Secondary (Maybe Later)

### Confirmation Screen
- Large checkmark icon or success animation
- Position number prominent (48px font size)
- Warm, welcoming copy
- Optional: Confetti animation 🎉

## Deployment

### Domain: maia.city
- **DNS:** Point to hosting provider
- **SSL:** Automatic (Let's Encrypt via Cloudflare/Vercel)
- **Hosting options:**
  - Static hosting (MaiaOS is runtime-based, no build needed)
  - Cloudflare Pages (recommended: static files + edge functions)
  - Vercel (static hosting)
  - Netlify (static hosting)
  - Any CDN (just serve `.maia` files + `o/kernel.js`)

### Environment Variables
**Required:**
- Jazz cloud connection: URL, app ID, app secret
- Web push: VAPID public key, private key, subject email
- Creem.io: Public key, secret key, webhook secret, product ID
- Analytics (optional): Plausible domain

### Build & Deploy
**MaiaOS requires no build process** - just deploy `.maia` files + kernel

**File structure:**
- `o/kernel.js` - MaiaOS kernel (single entry point)
- `waitlist.actor.maia` - Main actor definition
- `waitlist.view.maia` - UI structure
- `waitlist.state.maia` - State machine flow
- `waitlist.context.maia` - Runtime data
- `waitlist.style.maia` - Styling definitions
- `passkey.tool.maia` - WebAuthn tool
- `creem.tool.maia` - Payment tool
- `jazz.tool.maia` - Database tool
- `push.tool.maia` - Notification tool
- `sw.js` - Service worker

**Deployment:**
- Deploy to Cloudflare Pages, Vercel, Netlify, or any static hosting
- Browser loads kernel, kernel initializes engines, loads `.maia` files, renders UI
- No build, no compilation, pure runtime execution

### Service Worker
Must be served from root:
- `/sw.js` (service worker)
- `/manifest.json` (PWA manifest)
- `/icon-192.png` (notification icon)
- `/badge-72.png` (notification badge)

## Success Criteria

**Technical:**
- Landing page loads in <1 second
- Passkey creation succeeds (95%+ success rate)
- Jazz account syncs to cloud
- Push notifications deliver reliably
- Privacy policy is clear and accessible
- Works on mobile + desktop

**User Experience:**
- User understands they're joining a waitlist
- Signup feels fast and magical (passkey is cool)
- Notification prompt feels valuable (not spam)
- Confirmation screen creates excitement
- Daily notifications keep engagement high

**Metrics to track:**
- Waitlist signups per day
- Payment conversion rate (signups → paid)
- Payment completion time (signup → payment)
- Passkey success rate
- Notification subscription rate
- Daily notification open rate
- Returning visitor rate
- Urgency effectiveness (position change awareness)

## What We Learn

**Does invite-only create desire?**
- Do people want to join?
- Does scarcity increase value perception?

**Does the 1€ fee work?**
- What % of signups convert to paid?
- Does urgency messaging increase conversion?
- Do people return to pay later?
- Does payment filter out low-intent users?
- Does username reservation increase perceived value?
- Do people spend time choosing the "perfect" username?

**Do passkeys work?**
- Success rate on different devices
- User confusion or delight?

**Do notifications work?**
- Subscribe rate
- Open rate
- Unsubscribe rate

**Does urgency drive action?**
- Do users pay faster when they see position?
- Does "X ahead of you" create FOMO?
- Do returning users notice position changes?

**Is Jazz the right choice?**
- Developer experience
- Performance
- Sync reliability

## Out of Scope (Not in Milestone 0)

- No game yet (that's Milestone 1)
- No Hearts/Minds/Sparks
- No 3D world
- No referral system (yet)
- No admin dashboard (manual for now)
- No email notifications (push only)
- No 89€ full game purchase (only 1€ waitlist fee)

## Nice-to-Haves (Optional)

- **Discord integration:** "Join our Discord while you wait"
- **Progress bar:** Visual game development progress
- **Share button:** "Invite friends" (referral tracking)
- **Easter egg:** Hidden message in page source
- **Launch countdown:** "T-minus 47 days"
- **Payment reminder:** Email to unpaid users after 24h
- **Price increase warning:** "1€ now, 2€ after 1000 signups" (scarcity)
- **Live counter:** Real-time signup counter on landing page
- **Username suggestions:** If @alice is taken, suggest @alice.ai, @alice2, etc.
- **Username hall of fame:** Show recently reserved usernames (social proof)
- **Agent twin preview:** Show what @alice will look like in-game (avatar preview)

## Technical Challenges

**Challenge 1: Passkey browser support**
- Solution: Detect support, fallback to "Unsupported browser" message
- Target: Chrome, Safari, Firefox, Edge (all modern browsers)

**Challenge 2: Push notification delivery**
- Solution: Use reliable service (Firebase Cloud Messaging or web-push)
- Test thoroughly on iOS (limited support)

**Challenge 3: Jazz cloud reliability**
- Solution: Monitor sync status, show user if offline
- Fallback: Local storage only if cloud unavailable

**Challenge 4: Queue position calculation**
- Solution: Simple counter (increment on signup)
- Priority: Paid users before unpaid users in actual invites
- Future: Add referral boosts, priority tiers

**Challenge 5: Payment abandonment**
- Solution: Save signup even if payment fails
- Allow returning users to complete payment
- Send reminder notification after 24h
- Show urgency on return (position moved)
- Username remains "soft reserved" for 24h

**Challenge 6: Username conflicts**
- Solution: Real-time availability check
- Lock username during payment flow (5min)
- If payment fails, release lock
- If someone takes username during payment, prompt to choose new one

## Post-Launch (After Milestone 0)

Once waitlist is live:
1. **Gather feedback:** Discord, Twitter, direct messages
2. **Iterate on messaging:** Is it clear? Compelling?
3. **Monitor metrics:** Signups, notifications, engagement
4. **Prepare Milestone 1:** When do we start inviting?
5. **Batch invites:** First 1 person (Fibonacci), then 2, then 3...

## The Foundation

Milestone 0 establishes:
- **Identity system:** Passkeys + Jazz accounts
- **Communication channel:** Web push notifications
- **Community:** First believers, ready to play
- **Production infrastructure:** Domain, hosting, monitoring
- **Brand presence:** maia.city is live

Everything that follows builds on this foundation. Get this right, and launch is smooth.

---

**Outcome:** A beautiful, functional waitlist that builds anticipation, establishes identity, and prepares for Milestone 1 launch. The community is ready.
