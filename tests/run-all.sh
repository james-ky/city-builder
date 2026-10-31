#!/bin/bash
# Run every test against a URL (default: the live game), 4 at a time. shot-* files are screenshot tools, not tests.
# usage: tests/run-all.sh [url]   (needs playwright; set NODE_PATH if it isn't installed in this repo)
url=${1:-https://james-ky.github.io/city-builder/}; out=$(mktemp -d); cd "$(dirname "$0")/.."
ls tests/*.cjs | grep -v '/shot-' | xargs -P 4 -I{} sh -c 'n=$(basename {} .cjs); timeout 600 node {} "'"$url"'" > "'"$out"'/$n.log" 2>&1; echo "$n $?" >> "'"$out"'/summary"'
fails=$(awk '$2!=0{print $1}' "$out/summary" | sort); echo "$(wc -l < "$out/summary") tests, logs in $out"
if [ -n "$fails" ]; then echo "FAILED: $fails"; for f in $fails; do grep -h 'FAIL\|ERROR\|Error' "$out/$f.log" | head -5; done; exit 1; fi; echo "all passed"
