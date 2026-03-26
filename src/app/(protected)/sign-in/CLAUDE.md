# Sign-In Module

Working location tracking, Google Calendar sync, team history, kiosk mode, CSV/PDF export.

## Key Files

- **Shared types and config**: `src/lib/sign-in.ts` — `SignInEntry`, `TeamSignInEntry`, `LOCATION_CONFIG`, formatters
- **LocationBadge**: `src/components/sign-in/location-badge.tsx`
- **Server actions**: `src/app/(protected)/sign-in/actions.ts` — `getSignInHistory()` (single query, splits today/history), `getTeamMemberHistory()` (single member with line-manager verification), `getTeamSignInsToday()`, `getTeamSignInHistory()` (date-range report)

## Patterns

**Sanitise user-controlled fields in CSV exports (CSV injection).** User-controlled text fields can contain formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`). Prefix with a single quote (`'`) to force plain-text rendering. See `sanitiseCSVCell()` in `src/lib/csv.ts`, used by `reports-panel.tsx`.

## Google Calendar Integration

Setup docs in `docs/google-calendar-setup.md`. Domain-wide delegation via Google service account. Calendar events created/updated when setting working location for full-day entries.
