# RESUME for next iteration

Last iteration ran at: never
Last iteration result: NONE
Last slug: <none>

## Active bit

Set by the operator before the first iteration of a new bit.
For Bit 2 the operator will set:
  Active bit: Bit 2 — PC workflow cluster
  Branch: feature/wp-migration-bit-2 (off main)

## Last page migrated

(none — RALPH has not run yet)

## Next page

Determined by `scripts/ralph/progress.txt` for the active bit.

## Dev server

Status: assumed running on localhost:3000 before any iteration starts;
if down, ralph-once.sh halts and writes HALTED so the operator can
restart `npm run dev` and resume.

## Outstanding anomalies (non-blocking)

(none)

## Recently BLOCKED entries

(none yet — pre-tagged BLOCKED entries for Bits 5, 11, 12, 13, 14 are
in `progress.txt` from initial setup, not from a RALPH iteration)

## Chrome MCP

Strategy: call `tabs_context_mcp` first; reuse a tab whose URL matches the
target article URL, else create a new tab. Tab IDs are session-scoped
and NOT persisted across `claude` restarts — always discover anew.

Last URL: <none>

## Notes from previous iteration

(none — first run)
