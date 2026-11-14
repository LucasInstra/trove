#!/usr/bin/env bash
# Screenshots every route (and tab) of the browser preview. Start it first with
# `npx vite --config vite.preview.config.ts`.
# Usage: preview/shoot.sh <out-dir> [theme] [route[:tab]...]   (PORT=1421, SCALE=1, H=860 by default)
set -u
out="${1:?out dir}"; theme="${2:-light}"; shift 2 || true
specs=("$@")
[ ${#specs[@]} -eq 0 ] && specs=(overview transactions flow flow:trends cards cards:debts goals goals:house goals:retirement patrimony patrimony:investments patrimony:health categories import settings)
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
mkdir -p "$out"
win_out=$(cygpath -w "$out")
profile=$(cygpath -w "${TMPDIR:-/tmp}/trove-shoot-profile")
for spec in "${specs[@]}"; do
  route="${spec%%:*}"; tab=""; name="$route"
  if [[ "$spec" == *:* ]]; then tab="${spec#*:}"; name="$route-$tab"; fi
  "$chrome" --headless=new --disable-gpu --user-data-dir="$profile" --hide-scrollbars --window-size=1280,${H:-860} --force-device-scale-factor=${SCALE:-1} \
    --virtual-time-budget=4000 --screenshot="${win_out}\\${name}-${theme}.png" \
    "http://localhost:${PORT:-1421}/?route=$route${tab:+&tab=$tab}&theme=$theme${LAYOUT:+&layout=$LAYOUT}" >/dev/null 2>&1
done
ls "$out"
