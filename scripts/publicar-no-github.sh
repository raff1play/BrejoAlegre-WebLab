#!/usr/bin/env bash
# Linux/macOS/Codespaces. Clone a main real e envia branch separada sem merge/deploy.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$(dirname "$SRC")/BrejoAlegre-WebLab-git-upload"
BRANCH='setup/weblab-foundation'
if [ -e "$DEST" ]; then echo "ERROR: destination already exists: $DEST" >&2; exit 1; fi
git clone https://github.com/raff1play/BrejoAlegre-WebLab.git "$DEST"
git -C "$DEST" switch -c "$BRANCH"
( cd "$SRC" && tar --exclude='./.git' --exclude='./node_modules' --exclude='./dist' --exclude='./.vite' -cf - . ) | tar -xf - -C "$DEST"
git -C "$DEST" add -A
git -C "$DEST" status --short
git -C "$DEST" commit -m 'chore: prepare web lab scaffold and AI source of truth'
git -C "$DEST" push -u origin "$BRANCH"
echo 'Branch publicada. Abra PR manual:'
echo 'https://github.com/raff1play/BrejoAlegre-WebLab/compare/main...setup/weblab-foundation?expand=1'
