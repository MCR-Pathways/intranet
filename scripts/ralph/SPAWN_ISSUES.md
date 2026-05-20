# RALPH loop spawn issues — open

The Pure-LLM RALPH loop in this directory is structurally complete and
its non-claude parts smoke-test cleanly (STOP signal, BLOCKED case,
IN_PROGRESS detection, awk parsing, dev-server healthcheck, tsx
availability — all verified 2026-05-19). But the first attempt to run
it end-to-end on a real page (Bit 3 / group-work, 2026-05-20) crashed
at the claude-spawn step. Two real prerequisites surfaced that I hadn't
validated up front. Both are fixable; neither is fixed yet. Documented
here so the next person to pick up the loop knows what's pending.

## Issue 1 — `claude: command not found` in `ralph-once.sh`

### What happened

`scripts/ralph/ralph-once.sh:85` invokes `claude -p --permission-mode acceptEdits "$PROMPT"`. The subshell couldn't resolve `claude` and exited non-zero. The loop wrapper correctly detected this (RESUME.md still showing IN_PROGRESS) and halted via its crash-detection branch:

```
scripts/ralph/ralph-once.sh: line 85: claude: command not found
ralph-once.sh exited 1 with result=IN_PROGRESS. Halting.
```

### Why

The `claude` CLI was installed via nvm at `/Users/<user>/.nvm/versions/node/v24.14.1/bin/claude`. Interactive shells get that directory injected into `$PATH` via nvm's hook in `~/.zshrc`. **Non-interactive subshells (script execution, cron, CI) don't run `.zshrc` and so don't get the nvm PATH.** The shell that ran `ralph-once.sh` inherited the parent claude's PATH, which on this machine happens to include node-via-nvm — but a fresh non-interactive subshell launched from the script body wouldn't.

Verified: `which claude` from an interactive shell returns the nvm path; from a non-interactive subshell it returns nothing.

### Fix options (not yet applied)

**(a)** Source nvm in `ralph-once.sh` before invoking claude:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```
Pros: idiomatic, handles future node-version switches. Cons: assumes the operator uses nvm; tightly couples the loop to one shell config style.

**(b)** Resolve the absolute claude path via env var:
```bash
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude)}"
"$CLAUDE_BIN" -p ...
```
Operator exports `CLAUDE_BIN` once. Pros: portable; no assumption about install method. Cons: one more env var to remember.

**(c)** Document an operator-side wrapper. The operator runs `ralph-loop.sh` via a sourced shell that already has nvm loaded:
```bash
zsh -ic "scripts/ralph/ralph-loop.sh"
```
Cons: brittle; mixes interactive-mode-only behaviours with the loop.

Recommendation: **(b)**. Cleanest, most portable.

## Issue 2 — `ANTHROPIC_API_KEY` missing

### What happened

Even if Issue 1 is fixed and `claude` runs, `claude -p` (headless mode) needs an API key. The interactive Claude.ai OAuth login the operator uses for the regular `claude` CLI **does not authenticate `-p` mode**.

### Why

The Claude Code CLI has two auth paths:
- **Interactive (`claude` with no `-p`)**: OAuth via Claude.ai login. Tokens cached. Works in REPL.
- **Headless (`claude -p`)**: Requires `ANTHROPIC_API_KEY` env var. Calls the Anthropic API directly.

The loop pattern is fundamentally headless (no terminal for OAuth flow). So API-key access is non-negotiable for unattended runs.

### Fix options (not yet decided)

**(a)** Buy Anthropic API credits, set `ANTHROPIC_API_KEY` in `.env.local`, propagate via `ralph-once.sh`'s env. Cost is per-token; bit-sized runs are probably <$1 each but not free.

**(b)** Skip the loop entirely — run all bits in-session. Already-validated path. No incremental cost. Loses the unattended-run benefit but the scale here (22 pages) doesn't strictly need it.

**(c)** Hybrid for the rest of the migration — in-session for now, revisit loop spend at the end (or for an even bigger future migration where unattended runs pay off).

### Status

For Bit 3 specifically: fell back to in-session real run, same shape as Bit 1 and Bit 2. Loop validation pushed to whenever both issues are resolved.

## Side observation

The loop's crash-detection branch worked as designed:

1. ralph-once.sh wrote `IN_PROGRESS` to RESUME.md before invoking claude.
2. claude spawn failed; ralph-once.sh exited 1.
3. RESUME.md still said `IN_PROGRESS` because the inner claude never got to overwrite it.
4. ralph-loop.sh detected the non-zero exit + non-BLOCKED result, halted with the right message.

That's the IN_PROGRESS-marker pattern from PR #310 doing its job. Worth noting because the smoke tests synthesised this case via manually-written RESUME.md; this run proved it works on a real crash.
