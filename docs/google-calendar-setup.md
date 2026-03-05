# Google Calendar Integration — Setup Guide

This guide covers setting up domain-wide delegation for the MCR Pathways intranet to read and write working location events from Google Calendar.

## Prerequisites

- Google Workspace account (Business Standard+ or Nonprofits edition)
- Super Admin access to Google Workspace Admin Console
- Access to Google Cloud Console

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g. "MCR Intranet Calendar Sync")
3. Note the **Project ID** — you'll need it later

## 2. Enable the Google Calendar API

1. In the Cloud Console, go to **APIs & Services > Library**
2. Search for "Google Calendar API"
3. Click **Enable**

## 3. Create a Service Account

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Name: `intranet-calendar-sync`
4. Click **Create and Continue**
5. Skip the optional role assignment steps
6. Click **Done**

### Generate a Key

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Select **JSON** format
5. Download the key file — this is your `GOOGLE_SERVICE_ACCOUNT_KEY`

**Important:** Store this key securely. Never commit it to version control.

## 4. Set Up Domain-Wide Delegation

### In Google Cloud Console

1. Go to the service account details
2. Click **Show Advanced Settings**
3. Under "Domain-wide Delegation", click **Enable**
4. Note the **Client ID** (a long numeric string)

### In Google Workspace Admin Console

1. Go to [admin.google.com](https://admin.google.com/)
2. Navigate to **Security > Access and data control > API controls**
3. Click **Manage Domain Wide Delegation**
4. Click **Add new**
5. Enter:
   - **Client ID**: The numeric ID from the service account
   - **OAuth scopes**: `https://www.googleapis.com/auth/calendar`
6. Click **Authorise**

## 5. Configure Environment Variables

Add the following to your `.env.local` (or Vercel environment variables):

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"intranet-calendar-sync@project-id.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

Paste the entire JSON key file content as a single line. On Vercel, you can paste the multi-line JSON directly.

Optionally enable the calendar sync UI indicator:

```
NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=true
```

## 6. How It Works

### Working Location Events

Google Calendar supports a special event type called `workingLocation`. These events:

- Use `eventType: "workingLocation"` in the Calendar API
- Have `workingLocationProperties` with types: `homeOffice`, `officeLocation`, `customLocation`
- Must be `visibility: "public"` and `transparency: "transparent"`
- Only exist on the user's primary calendar

### Sync Flow

1. **Periodic sync** (every 6 hours via cron): Calls `syncAllUsers()` which iterates over all active staff
2. **Manual sync**: Users can trigger from the Working Location page via "Sync Now"
3. **Incremental sync**: Uses Google's `syncToken` to only fetch changes since the last sync
4. **Full sync fallback**: If the sync token expires (410 Gone), automatically falls back to a full sync

### Override Hierarchy

The system respects a strict override hierarchy:

```
leave > manual > calendar > pattern
```

- **Leave**: Created automatically when leave is approved. Cannot be overridden.
- **Manual**: Set by the user via the intranet UI. Overrides calendar and pattern entries.
- **Calendar**: Synced from Google Calendar. Overrides pattern entries only.
- **Pattern**: Applied from the user's default weekly pattern. Lowest priority.

### Write-Back

When a user sets their location via the intranet UI (manual source), the system writes back to Google Calendar:

1. Creates/updates a `workingLocation` event for that date
2. Stores the Google Calendar event ID for future updates
3. Non-blocking — failures are logged but don't block the UI action

### Out-of-Office Events

When leave is approved:

1. An OOO (Out of Office) event is created on the user's Google Calendar
2. The OOO event ID is stored on the leave request for cleanup
3. When leave is cancelled, the OOO event is deleted

## 7. Troubleshooting

### "Calendar sync not configured"

The `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable is not set or is empty.

### "Access denied" during sync

The service account doesn't have domain-wide delegation for the user's email. Check:

1. The service account has domain-wide delegation enabled in Cloud Console
2. The correct OAuth scope is authorised in Workspace Admin Console
3. The Client ID matches between Cloud Console and Admin Console

### Sync token expired (410 Gone)

This is normal — Google invalidates sync tokens periodically. The system automatically retries with a full sync. No action needed.

### Events not appearing

Working location events only appear on the user's **primary calendar**. Events on secondary or shared calendars are not synced.

## 8. Database Schema

The sync uses these tables:

- `working_locations` — Stores all working location entries (all sources)
  - `source` column: `"calendar"`, `"manual"`, `"pattern"`, or `"leave"`
  - `google_event_id` column: Links to the Google Calendar event
- `profiles` — Stores sync state per user
  - `calendar_sync_token`: Google's incremental sync token
  - `calendar_last_synced_at`: Timestamp of last successful sync

## 9. Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-calendar.ts` | Google Calendar API wrapper (read, write, delete events) |
| `src/lib/calendar-sync.ts` | Sync logic (single user + batch) |
| `src/lib/leave-location-sync.ts` | Leave approval → working location entries + OOO events |
| `src/app/(protected)/sign-in/actions.ts` | Server actions for manual sync trigger |
| `src/app/api/calendar/webhook/route.ts` | Webhook endpoint for push notifications (if configured) |
