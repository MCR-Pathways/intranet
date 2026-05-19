#!/usr/bin/env bash
# One RALPH iteration. Locks, marks IN_PROGRESS, invokes claude, exits.
# Returns 0 on COMPLETE/BIT-COMPLETE/HALTED, non-zero on BLOCKED/crash.
#
# The loop wrapper (ralph-loop.sh) reads RESUME.md's
# "Last iteration result:" line to decide whether to continue. This
# script writes "IN_PROGRESS" before invoking claude so a mid-iteration
# crash leaves a detectable marker.
set -euo pipefail

cd "$(dirname "$0")/../.."  # repo root

LOCK_FILE=scripts/ralph/.lock
RESUME=scripts/ralph/RESUME.md

# Refuse to start if another iteration holds the lock.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another RALPH iteration is running. Refusing to start." >&2
  exit 2
fi

# Healthcheck the dev server. Operator starts it manually before the loop.
if ! curl -fsS --max-time 5 http://localhost:3000 > /dev/null; then
  echo "Dev server not responding at localhost:3000. Halting." >&2
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

# Mark IN_PROGRESS so a mid-iteration crash is detectable by the loop
# wrapper. The inner claude session will overwrite this on a clean exit.
printf '%s\n' \
  "Last iteration ran at: $(date -u +%FT%TZ)" \
  "Last iteration result: IN_PROGRESS" \
  "Last slug: <pending>" > "$RESUME.tmp"
mv "$RESUME.tmp" "$RESUME"

PROMPT='Read scripts/ralph/RESUME.md (handover), then scripts/ralph/PRD.md (rules), then scripts/ralph/progress.txt (todo list). Also read root CLAUDE.md, src/app/(protected)/resources/CLAUDE.md, src/lib/CLAUDE.md, docs/button-system.md. Then follow the per-iteration loop shape from PRD.md: select next [ ] page in the active bit, run `npx tsx scripts/migrate-wp-page.ts --slug=<slug> --xml=/Users/abdulmuizadaranijo/Desktop/oldintranet.xml --category-slug=<sub> --parent-category-slug=<parent>` on it, verify in Chrome MCP per the PRD checklist, fix Tier 1 inline / [BLOCKED] Tier 2 novel, commit (commit-message template in PRD), atomically update progress.txt + RESUME.md (write to .tmp then mv), exit. The `Last iteration result:` line in RESUME.md is the loop wrappers source of truth — it must be one of COMPLETE | BIT-COMPLETE | BLOCKED | HALTED when you exit.'

# Per-iteration timeout: 30 minutes hard cap.
timeout 1800 claude -p --permission-mode acceptEdits "$PROMPT"
EXIT=$?

# If claude exited non-zero or timed out, RESUME.md will still show
# IN_PROGRESS so the loop wrapper can detect the crash.
exit $EXIT
