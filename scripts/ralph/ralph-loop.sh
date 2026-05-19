#!/usr/bin/env bash
# Continuous RALPH loop. Wrapper around ralph-once.sh.
#
# Stops on:
#   - STOP file present at scripts/ralph/STOP (touch to halt cleanly)
#   - BIT-COMPLETE (pause for PR review)
#   - HALTED (inner iteration decided to stop)
#   - 3 consecutive BLOCKED (something systemic)
#   - same slug reports COMPLETE twice (write-back failed)
#   - IN_PROGRESS lingering (claude crashed mid-iteration)
#   - non-zero exit from ralph-once.sh with non-BLOCKED result
#
# Appends each iteration's RESUME.md snapshot to ralph-history.log so
# multi-iteration postmortems remain reconstructable.
set -uo pipefail

cd "$(dirname "$0")/../.."

CONSECUTIVE_BLOCKED=0
MAX_CONSECUTIVE_BLOCKED=3
LAST_SLUG=""
SAME_SLUG_RUN=0
RESUME=scripts/ralph/RESUME.md
HISTORY=scripts/ralph/ralph-history.log

mkdir -p "$(dirname "$HISTORY")"

while true; do
  if [ -f scripts/ralph/STOP ]; then
    echo "STOP file present. Halting loop." | tee -a "$HISTORY"
    exit 0
  fi

  scripts/ralph/ralph-once.sh
  EXIT=$?

  # Snapshot the just-finished RESUME.md to history before reading it.
  {
    echo "===== $(date -u +%FT%TZ) (exit $EXIT) ====="
    cat "$RESUME"
    echo
  } >> "$HISTORY"

  LAST_RESULT=$(awk -F':[[:space:]]*' '/^Last iteration result:/ { print $2; exit }' "$RESUME")
  CURRENT_SLUG=$(awk -F':[[:space:]]*' '/^Last slug:/ { print $2; exit }' "$RESUME")

  if [ "$EXIT" -ne 0 ] && [ "$LAST_RESULT" != "BLOCKED" ]; then
    echo "ralph-once.sh exited $EXIT with result=$LAST_RESULT. Halting." | tee -a "$HISTORY"
    exit 1
  fi

  case "$LAST_RESULT" in
    "COMPLETE")
      CONSECUTIVE_BLOCKED=0
      if [ -n "$CURRENT_SLUG" ] && [ "$CURRENT_SLUG" = "$LAST_SLUG" ]; then
        SAME_SLUG_RUN=$((SAME_SLUG_RUN + 1))
        if [ "$SAME_SLUG_RUN" -ge 2 ]; then
          echo "Same slug ($CURRENT_SLUG) reported COMPLETE twice. Possible commit/write failure. Halting." | tee -a "$HISTORY"
          exit 1
        fi
      else
        SAME_SLUG_RUN=0
      fi
      LAST_SLUG="$CURRENT_SLUG"
      echo "Iteration COMPLETE on $CURRENT_SLUG. Restarting." | tee -a "$HISTORY"
      ;;
    "BIT-COMPLETE")
      echo "Bit complete. Pausing loop for PR review." | tee -a "$HISTORY"
      exit 0
      ;;
    "BLOCKED")
      CONSECUTIVE_BLOCKED=$((CONSECUTIVE_BLOCKED + 1))
      if [ "$CONSECUTIVE_BLOCKED" -ge "$MAX_CONSECUTIVE_BLOCKED" ]; then
        echo "$MAX_CONSECUTIVE_BLOCKED consecutive BLOCKED. Halting." | tee -a "$HISTORY"
        exit 1
      fi
      echo "BLOCKED ($CONSECUTIVE_BLOCKED/$MAX_CONSECUTIVE_BLOCKED). Restarting." | tee -a "$HISTORY"
      ;;
    "HALTED")
      echo "HALTED by inner iteration. Exiting." | tee -a "$HISTORY"
      exit 0
      ;;
    "IN_PROGRESS")
      echo "RESUME.md still IN_PROGRESS — claude crashed or timed out. Halting for inspection." | tee -a "$HISTORY"
      exit 1
      ;;
    *)
      echo "Unknown result: '$LAST_RESULT'. Halting for safety." | tee -a "$HISTORY"
      exit 1
      ;;
  esac
done
