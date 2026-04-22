# Patterns

Cross-cutting code patterns used across the MCR intranet. Module-specific patterns live in the module's `CLAUDE.md`; UI-component patterns live in `docs/button-system.md`, `docs/design-system.md`, etc. Start a new section here when a pattern reappears in three or more modules.

## Preventing duplicate submits

Click handlers that trigger async work (save, submit, approve, publish, enrol, delete) must make the action idempotent within the user's click. A double-click before the first response lands creates duplicate rows, duplicate emails, duplicate webhook calls.

Use one of these patterns:

- **`useTransition`** for server-action triggers. The `isPending` flag disables the Button while the action is in flight. Pair with `<ButtonSpinner>` and verb-ing label ("Saving..."). Most of our form/dialog submit handlers already use this.
- **In-flight ref guard** for non-React-18 contexts or when `useTransition` isn't available. A `useRef<boolean>` set to true on click entry and false on completion. Early-return the handler if the ref is true.
- **Server-side idempotency** for irreversible commits (publish, approve, send email). The Button-level guard is the last line of defence; the server action also rejects a duplicate op (e.g. unique constraint on the target state transition).

The Button primitive itself does not debounce — that's the handler's job. `ButtonSpinner` + `disabled={pending}` is the visible half; the handler logic is the invisible half. Both must exist.

## More patterns

Add sections as cross-cutting patterns emerge. Candidate future entries: post-action `aria-live` status regions, optimistic-UI rollback patterns, prefetch scoping rules.
