# Attribute Sanitizer: Whitelist Plan

## Problem
The current `containsDangerousHTML` + `sanitizeAttribute` uses a **blacklist** approach: we check for known dangerous patterns and escape if found. This is fragile—new attack vectors can slip through.

## Solution: Whitelist-Only
**Nothing allowed by default.** Only explicitly whitelisted characters pass through. All other characters are stripped.

## Whitelist Definition
For attribute values that display user/AI-generated content:

| Category | Characters |
|----------|------------|
| Letters | `a-zA-Z` + Unicode letters `\p{L}` |
| Numbers | `0-9` + Unicode numbers `\p{N}` |
| Whitespace | space, tab, newline `\s` |
| Safe punctuation | `. , ! ? - _ : ; @ # ( ) + = [ ] ~ & % /` |

**Explicitly excluded** (never allowed): `< > " ' \ ` ^ { } |` and control characters.

## Implementation
- `sanitizeAttributeWhitelist(value)` → string with only whitelisted chars
- Replace `containsDangerousHTML` + conditional `sanitizeAttribute` with **always** calling `sanitizeAttributeWhitelist` for any user-sourced string going into `setAttribute`
- No fallback to raw value—whitelist is the only path

## Usage
All attribute values from view config (class, attrs, data-*, etc.) that may contain user/AI data flow through this. Co-ids and boolean attrs have separate handling.

## Trade-off
Strings like `Hello <world>` become `Hello world` (angle brackets stripped). This is acceptable for security—display may lose some formatting, but XSS is prevented by design.
