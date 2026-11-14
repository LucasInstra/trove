#!/usr/bin/env bash
# Screenshots every route of the browser preview (start it first with
# `npx vite --config vite.preview.config.ts`). Usage: preview/shoot.sh <out-dir> [theme] [routes...]
set -u
out="${1:?out dir}"; theme="${2:-light}"; shift 2 || true
routes=("$@")
[ ${#routes[@]} -eq 0 ] && routes=(overview transactions flow cards reserve house income patrimony flows health debts retirement categories import settings)
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
mkdir -p "$out"
win_out=$(cygpath -w "$out")
for route in "${routes[@]}"; do
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,${H:-860} \
    --virtual-time-budget=4000 --screenshot="$win_out\\$route-$theme.png" \
    "http://localhost:1421/?route=$route&theme=$theme${LAYOUT:+&layout=$LAYOUT}" >/dev/null 2>&1
done
ls "$out"
