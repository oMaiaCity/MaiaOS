#!/usr/bin/env bash
# Run after native Homebrew exists at /opt/homebrew (Apple Silicon).
# One-time install (requires your macOS password): see MESSAGE below.
set -euo pipefail

ARM_BREW="/opt/homebrew/bin/brew"
INTEL_BREW="/usr/local/bin/brew"

if [[ ! -x "$ARM_BREW" ]]; then
	echo "Native Homebrew is not installed at /opt/homebrew."
	echo ""
	echo "Run this once in Terminal (installer will ask for your password):"
	echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
	echo ""
	echo "Then open a new terminal (or: source ~/.zprofile) and run:"
	echo "  bash $(cd "$(dirname "$0")" && pwd)/homebrew-arm-bootstrap.sh"
	exit 1
fi

eval "$("$ARM_BREW" shellenv)"

echo "==> Verify ARM Homebrew"
command -v brew
"$ARM_BREW" config | grep -E 'HOMEBREW_PREFIX|CPU|Rosetta' || true

echo "==> Install Sentrux (darwin-arm64 URL from tap)"
"$ARM_BREW" tap sentrux/tap 2>/dev/null || true
"$ARM_BREW" install sentrux/tap/sentrux

if [[ -x "$INTEL_BREW" ]]; then
	echo "==> Migrate formulae from Intel-prefix Homebrew ($INTEL_BREW)"
	echo "    (Failures are logged; fix taps/versions manually if needed.)"
	while IFS= read -r pkg; do
		[[ -z "$pkg" ]] && continue
		if "$ARM_BREW" list --formula "$pkg" &>/dev/null; then
			echo "  skip (already installed): $pkg"
			continue
		fi
		echo "  install: $pkg"
		if ! "$ARM_BREW" install "$pkg"; then
			echo "  WARN: failed: $pkg — install manually if required"
		fi
	done < <("$INTEL_BREW" list --formula -1)
else
	echo "==> No $INTEL_BREW — skipping migration"
fi

echo ""
echo "==> Done."
echo "Sentrux: $(command -v sentrux)"
echo ""
echo "When everything works from /opt/homebrew only, remove Intel Homebrew per:"
echo "  https://docs.brew.sh/Uninstall"
echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)\""
echo "(Follow the prompts; choose uninstall for /usr/local if offered.)"
