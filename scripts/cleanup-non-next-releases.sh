#!/usr/bin/env bash
# Delete GitHub releases and git tags that are NOT next-line prereleases (tag name must contain "-next").
# Keeps e.g. v26.4.20949-next; removes legacy v26.4.x, v1.0.0, drafts, etc.
#
# Usage:
#   DRY_RUN=1 ./scripts/cleanup-non-next-releases.sh   # print only
#   ./scripts/cleanup-non-next-releases.sh --execute   # delete (requires gh auth + git push)

set -euo pipefail

KEEP_SUB="-next"
EXECUTE="${1:-}"

if [[ "$EXECUTE" != "--execute" ]]; then
	echo "Dry run (no deletes). Run with: $0 --execute"
	DRY_RUN=1
else
	DRY_RUN=""
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Repository: $REPO"

delete_release() {
	local tag="$1"
	if [[ -n "$DRY_RUN" ]]; then
		echo "[dry-run] gh release delete $tag --cleanup-tag"
		return
	fi
	gh release delete "$tag" --yes --cleanup-tag -R "$REPO" || true
}

delete_tag_ref() {
	local tag="$1"
	if [[ -n "$DRY_RUN" ]]; then
		echo "[dry-run] DELETE refs/tags/$tag"
		return
	fi
	gh api -X DELETE "repos/${REPO}/git/refs/tags/${tag}" 2>/dev/null || true
	git push origin ":refs/tags/${tag}" 2>/dev/null || true
}

should_keep() {
	[[ "$1" == *"${KEEP_SUB}"* ]]
}

# 1) All releases (including drafts)
while IFS= read -r tag; do
	[[ -z "$tag" ]] && continue
	if should_keep "$tag"; then
		echo "KEEP release: $tag"
		continue
	fi
	echo "Remove release (+ tag if present): $tag"
	delete_release "$tag"
done < <(gh release list --limit 1000 --json tagName -q '.[].tagName' -R "$REPO")

# 2) Orphan tags (no release)
while IFS= read -r tag; do
	[[ -z "$tag" ]] && continue
	if should_keep "$tag"; then
		continue
	fi
	echo "Remove orphan tag: $tag"
	delete_tag_ref "$tag"
done < <(
	git ls-remote --tags origin 2>/dev/null | awk '{print $2}' |
		sed 's|refs/tags/||' |
		grep -v '\^{}' |
		sort -u
)

if [[ -n "$DRY_RUN" ]]; then
	echo "Done (dry run). Pass --execute to apply."
else
	echo "Done."
fi
