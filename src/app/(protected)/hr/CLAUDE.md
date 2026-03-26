# HR Module

User management, profile, leave, absence, assets, compliance, key dates, departments, leaving, flexible working, onboarding, org chart.

## Structure

**20 action files** across `src/app/(protected)/hr/` — one per feature area (users, profile, leave, absence, assets, compliance, departments, key-dates, leaving, flexible-working, onboarding).

**59 components** in `src/components/hr/` (flat structure). Consider grouping by feature as Phase 3 grows.

**Config-driven badges** in `src/lib/hr.ts` (938 lines). Status configs (`LEAVE_TYPE_CONFIG`, `RTW_STATUS_CONFIG`, `LEAVING_STATUS_CONFIG`, `ONBOARDING_STATUS_CONFIG`) use `badgeVariant` prop mapping to semantic Badge variants. For non-standard colours, use `<Badge className={cn(config.bgColour, config.colour, "border-0")}>`.

## Patterns

**Use `muted` variant for inactive/disabled states, never `destructive`.** Red implies something went wrong. Inactive is neutral — use `muted` (grey). Active→`success`, Inactive→`muted`.

**Use tonal/subtle fills for badges, never solid fills.** `bg-{colour}-50 text-{colour}-700` — the industry standard. Never `bg-green-500 text-white`. See `docs/design-system.md` section 1.8.

**Use Badge `variant` prop, never `variant="outline"` with className colour overrides.** When a status config maps to a standard variant, use `<Badge variant={config.badgeVariant}>`.

## Known Improvement Areas

- **Large action files**: `absence/actions.ts` (966 lines), `flexible-working/actions.ts` (1167 lines), `onboarding/actions.ts` (1140 lines) could benefit from splitting
- **No scheduled notifications**: Key dates, compliance expiry, stale leave requests — HR admins must manually check dashboards
- **No bulk operations**: Leave entitlements, compliance assignments, onboarding checklists all one-at-a-time
- **Absence hard-deletes** (line 381 of absence/actions.ts) — soft-delete with `deleted_at` safer for tribunal audit
