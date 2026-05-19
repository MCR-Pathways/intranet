#!/usr/bin/env bash
# One RALPH iteration. Locks, marks IN_PROGRESS, invokes claude, exits.
# Returns 0 on COMPLETE/BIT-COMPLETE/HALTED, non-zero on BLOCKED/crash.
#
# The loop wrapper (ralph-loop.sh) reads RESUME.md's
# "Last iteration result:" line to decide whether to continue. This
# script writes "IN_PROGRESS" before invoking claude so a mid-iteration
# crash leaves a detectable marker.
#
# Configurable env vars (defaults work for the original operator's setup):
#   WP_XML_PATH         — absolute path to the WP export XML
#                         (default: ~/Desktop/oldintranet.xml)
#   RALPH_TIMEOUT_SECS  — per-iteration wall-clock cap
#                         (default: 1800 = 30 minutes)
#   RALPH_DEV_URL       — dev server URL to healthcheck
#                         (default: http://localhost:3000)
set -euo pipefail

cd "$(dirname "$0")/../.."  # repo root

WP_XML_PATH="${WP_XML_PATH:-$HOME/Desktop/oldintranet.xml}"
RALPH_TIMEOUT_SECS="${RALPH_TIMEOUT_SECS:-1800}"
RALPH_DEV_URL="${RALPH_DEV_URL:-http://localhost:3000}"

LOCK_DIR=scripts/ralph/.lock
RESUME=scripts/ralph/RESUME.md

# Refuse to start if another iteration holds the lock. mkdir is atomic
# on POSIX filesystems so this works without flock (which is a GNU
# util-linux tool that macOS doesn't ship). The trap below removes the
# lock on any exit, including kill.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another RALPH iteration is running (lock dir $LOCK_DIR exists). Refusing to start." >&2
  echo "If you're sure no iteration is active, run: rm -rf $LOCK_DIR" >&2
  exit 2
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

# Healthcheck the dev server. Operator starts it manually before the loop.
if ! curl -fsS --max-time 5 "$RALPH_DEV_URL" > /dev/null; then
  echo "Dev server not responding at $RALPH_DEV_URL. Halting." >&2
  printf '%s\n' \
    "Last iteration ran at: $(date -u +%FT%TZ)" \
    "Last iteration result: HALTED" \
    "Last slug: <healthcheck-failed>" \
    "Reason: dev server down" > "$RESUME.tmp"
  mv "$RESUME.tmp" "$RESUME"
  exit 0
fi

# Confirm tsx is available before invoking claude. Catches a corrupted
# node_modules with a clear error rather than "command not found" mid-
# migration (tsx IS in devDependencies, this is defensive).
if ! npx tsx --version > /dev/null 2>&1; then
  echo "npx tsx unavailable. Run \`npm install\` and retry." >&2
  exit 2
fi

# Verify the XML file is reachable before invoking claude. Saves a
# 30-second startup just to fail with a more obscure error.
if [ ! -r "$WP_XML_PATH" ]; then
  echo "WP_XML_PATH does not exist or is not readable: $WP_XML_PATH" >&2
  echo "Set WP_XML_PATH=/absolute/path/to/oldintranet.xml and retry." >&2
  exit 2
fi

# Mark IN_PROGRESS so a mid-iteration crash is detectable by the loop
# wrapper. The inner claude session will overwrite this on a clean exit.
printf '%s\n' \
  "Last iteration ran at: $(date -u +%FT%TZ)" \
  "Last iteration result: IN_PROGRESS" \
  "Last slug: <pending>" > "$RESUME.tmp"
mv "$RESUME.tmp" "$RESUME"

PROMPT="Read scripts/ralph/RESUME.md (handover), then scripts/ralph/PRD.md (rules), then scripts/ralph/progress.txt (todo list). Also read root CLAUDE.md, src/app/(protected)/resources/CLAUDE.md, src/lib/CLAUDE.md, docs/button-system.md. Then follow the per-iteration loop shape from PRD.md: select next [ ] page in the active bit, run \`npx tsx scripts/migrate-wp-page.ts --slug=<slug> --xml=$WP_XML_PATH --category-slug=<sub> --parent-category-slug=<parent>\` on it, verify in Chrome MCP per the PRD checklist, fix Tier 1 inline / [BLOCKED] Tier 2 novel, commit (commit-message template in PRD), atomically update progress.txt + RESUME.md (write to .tmp then mv), exit. The \`Last iteration result:\` line in RESUME.md is the loop wrapper's source of truth — it must be one of COMPLETE | BIT-COMPLETE | BLOCKED | HALTED when you exit."

# Per-iteration wall-clock cap via a watchdog subshell. macOS doesn't
# ship GNU `timeout`, so we roll our own: a backgrounded sleep+kill that
# the EXIT trap above tears down on clean return.
(
  sleep "$RALPH_TIMEOUT_SECS"
  echo "ralph-once.sh: $RALPH_TIMEOUT_SECS-second timeout reached, killing claude" >&2
  kill -TERM $$ 2>/dev/null
) &
WATCHDOG_PID=$!
# Augment the existing EXIT trap to also kill the watchdog on any exit.
trap 'kill "$WATCHDOG_PID" 2>/dev/null; rm -rf "$LOCK_DIR"' EXIT

set +e
claude -p --permission-mode acceptEdits "$PROMPT"
EXIT=$?
set -e

# If claude exited non-zero or the watchdog fired, RESUME.md will still
# show IN_PROGRESS so the loop wrapper can detect the crash.
exit "$EXIT"
