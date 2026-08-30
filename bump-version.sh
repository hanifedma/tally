#!/usr/bin/env bash
# Bump the cache-busting version across the whole site, in one place.
#
#     ./bump-version.sh          # next number
#     ./bump-version.sh 7        # a specific one
#
# Every ?v=N in index.html, sw.js and the modules moves together, along with
# the <meta name="app-version"> the running app compares against
# version.json. Miss one and a browser happily runs new HTML against old
# JavaScript, which is the worst kind of bug to reproduce.
set -euo pipefail
cd "$(dirname "$0")"

current=$(grep -o 'name="app-version" content="[0-9]*"' index.html | grep -o '[0-9]*')
next=${1:-$((current + 1))}

echo "Version $current → $next"

sed -i.bak -E "s/(name=\"app-version\" content=\")[0-9]+(\")/\1$next\2/" index.html
sed -i.bak -E "s/(\?v=)[0-9]+/\1$next/g" index.html tests.html sw.js app.js store.js i18n.js tests.js
sed -i.bak -E "s/(tally-v)[0-9]+/\1$next/" sw.js
printf '{ "version": "%s" }\n' "$next" > version.json
rm -f ./*.bak

echo "Done. Files touched:"
grep -l "v=$next" ./*.html ./*.js 2>/dev/null || true
