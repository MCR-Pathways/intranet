import { google, calendar_v3 } from "googleapis";
import { logger } from "@/lib/logger";

// =============================================
// TYPES
// =============================================

/** Google Calendar working location types mapped to our locations */
export type GoogleLocationType = "homeOffice" | "officeLocation" | "customLocation";

export interface CalendarWorkingLocation {
  date: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (exclusive, Google Calendar convention)
  locationType: GoogleLocationType;
  officeLabel?: string; // For officeLocation type
  customLabel?: string; // For customLocation type
  eventId: string;
}

// =============================================
// SERVICE ACCOUNT AUTH
// =============================================

/**
 * Create an authenticated Google Calendar client using service account
 * with domain-wide delegation, impersonating the given user.
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY env var (base64-encoded JSON key).
 */
function getServiceAccountKey(): { client_email: string; private_key: string } {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable");
  }
  try {
    return JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"));
  } catch (err) {
    throw new Error(
      `Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ${err instanceof Error ? err.message : "invalid base64 or JSON"}`
    );
  }
}

/** Mask an email address for safe logging (e.g. "a***@mcrpathways.org"). */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

function getCalendarClient(userEmail: string): calendar_v3.Calendar {
  const keyJson = getServiceAccountKey();

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    subject: userEmail, // Domain-wide delegation impersonation
  });

  return google.calendar({ version: "v3", auth });
}

/**
 * Create a Calendar client with write access (calendar.events scope).
 * Used for writing working location events and OOO events back to Calendar.
 */
function getWritableCalendarClient(userEmail: string): calendar_v3.Calendar {
  const keyJson = getServiceAccountKey();

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    subject: userEmail,
  });

  return google.calendar({ version: "v3", auth });
}

// =============================================
// OFFICE LABEL MAPPING
// =============================================

/** Map Google Calendar office labels to our location keys */
const OFFICE_LABEL_MAP: Record<string, "glasgow_office" | "stevenage_office"> = {
  "glasgow": "glasgow_office",
  "glasgow office": "glasgow_office",
  "stevenage": "stevenage_office",
  "stevenage office": "stevenage_office",
};

/**
 * Try to match an office location label from Google Calendar
 * to one of our known office locations.
 */
function matchOfficeLabel(label: string | undefined | null): "glasgow_office" | "stevenage_office" | null {
  if (!label) return null;
  const normalised = label.toLowerCase().trim();
  return OFFICE_LABEL_MAP[normalised] ?? null;
}

// =============================================
// WORKING LOCATION EXTRACTION
// =============================================

/**
 * Extract working location data from a Google Calendar event.
 * Returns null if the event doesn't contain working location properties.
 */
function extractWorkingLocation(event: calendar_v3.Schema$Event): CalendarWorkingLocation | null {
  if (event.eventType !== "workingLocation" || !event.workingLocationProperties) {
    return null;
  }

  const props = event.workingLocationProperties;
  const startDate = event.start?.date;
  const endDate = event.end?.date;

  if (!startDate || !endDate || !event.id) {
    return null;
  }

  let locationType: GoogleLocationType;

  if (props.homeOffice !== undefined && props.homeOffice !== null) {
    locationType = "homeOffice";
  } else if (props.officeLocation) {
    locationType = "officeLocation";
  } else if (props.customLocation) {
    locationType = "customLocation";
  } else {
    return null;
  }

  return {
    date: startDate,
    endDate,
    locationType,
    officeLabel: props.officeLocation?.label ?? undefined,
    customLabel: props.customLocation?.label ?? undefined,
    eventId: event.id,
  };
}

// =============================================
// MAP TO OUR LOCATION FORMAT
// =============================================

export interface MappedWorkingLocation {
  date: string;
  location: "home" | "glasgow_office" | "stevenage_office" | "other";
  otherLocation: string | null;
  googleEventId: string;
}

/**
 * Map a Google Calendar working location to our internal location format.
 * Multi-day events are expanded into individual days.
 */
export function mapCalendarLocation(calLoc: CalendarWorkingLocation): MappedWorkingLocation[] {
  const results: MappedWorkingLocation[] = [];

  // Expand multi-day events into individual dates
  const startDate = new Date(calLoc.date + "T12:00:00Z");
  const endDate = new Date(calLoc.endDate + "T12:00:00Z"); // exclusive

  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];

    // Skip weekends
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    let location: "home" | "glasgow_office" | "stevenage_office" | "other";
    let otherLocation: string | null = null;

    switch (calLoc.locationType) {
      case "homeOffice":
        location = "home";
        break;
      case "officeLocation": {
        const matched = matchOfficeLabel(calLoc.officeLabel);
        if (matched) {
          location = matched;
        } else {
          // Unknown office — treat as "other" with the label
          location = "other";
          otherLocation = calLoc.officeLabel ?? "Office";
        }
        break;
      }
      case "customLocation":
        location = "other";
        otherLocation = calLoc.customLabel ?? null;
        break;
    }

    results.push({
      date: dateStr,
      location,
      otherLocation,
      googleEventId: calLoc.eventId,
    });
  }

  return results;
}

// =============================================
// FETCH WORKING LOCATIONS
// =============================================

export interface CalendarSyncResult {
  locations: MappedWorkingLocation[];
  nextSyncToken: string | null;
}

/**
 * Fetch working location events from a user's Google Calendar.
 *
 * @param userEmail - The user's Google Workspace email
 * @param syncToken - Previous sync token for incremental sync (null for full sync)
 * @param timeMin - Start of range for full sync (ISO string)
 * @param timeMax - End of range for full sync (ISO string)
 */
export async function fetchWorkingLocations(
  userEmail: string,
  syncToken: string | null,
  timeMin?: string,
  timeMax?: string,
): Promise<CalendarSyncResult> {
  const calendar = getCalendarClient(userEmail);
  const locations: MappedWorkingLocation[] = [];
  let nextPageToken: string | undefined;
  let nextSyncToken: string | null = null;

  try {
    do {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId: "primary",
        eventTypes: ["workingLocation"],
        singleEvents: true,
        maxResults: 250,
        pageToken: nextPageToken,
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        // Full sync — bounded time range
        if (timeMin) params.timeMin = timeMin;
        if (timeMax) params.timeMax = timeMax;
      }

      const response = await calendar.events.list(params);
      const events = response.data.items ?? [];

      for (const event of events) {
        // Cancelled events (from incremental sync) have status "cancelled"
        if (event.status === "cancelled") {
          // We'll handle deletions in calendar-sync.ts
          // Include with a special marker
          if (event.id) {
            locations.push({
              date: "",
              location: "home", // placeholder — sync logic checks googleEventId
              otherLocation: null,
              googleEventId: event.id,
            });
          }
          continue;
        }

        const calLoc = extractWorkingLocation(event);
        if (calLoc) {
          locations.push(...mapCalendarLocation(calLoc));
        }
      }

      nextPageToken = response.data.nextPageToken ?? undefined;
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken;
      }
    } while (nextPageToken);

    return { locations, nextSyncToken };
  } catch (error: unknown) {
    const apiError = error as { code?: number; message?: string };

    // 410 Gone = sync token expired, need full sync
    if (apiError.code === 410) {
      logger.warn("Calendar sync token expired, need full sync", { userEmail: maskEmail(userEmail) });
      return { locations: [], nextSyncToken: null };
    }

    // 403 = delegation not set up or user not in domain
    if (apiError.code === 403) {
      logger.warn("Calendar access denied for user", { userEmail: maskEmail(userEmail), error: apiError.message });
      return { locations: [], nextSyncToken: null };
    }

    throw error;
  }
}

// =============================================
// WRITE-BACK: WORKING LOCATION EVENTS
// =============================================

/** Map our internal location to Google Calendar working location properties */
function toGoogleWorkingLocationProperties(
  location: "home" | "glasgow_office" | "stevenage_office" | "other",
  otherLocation?: string | null,
): calendar_v3.Schema$EventWorkingLocationProperties {
  switch (location) {
    case "home":
      return { type: "homeOffice", homeOffice: {} };
    case "glasgow_office":
      return {
        type: "officeLocation",
        officeLocation: { label: "Glasgow Office" },
      };
    case "stevenage_office":
      return {
        type: "officeLocation",
        officeLocation: { label: "Stevenage Office" },
      };
    case "other":
      return {
        type: "customLocation",
        customLocation: { label: otherLocation ?? "Other" },
      };
  }
}

/**
 * Create or update a working location event in the user's Google Calendar.
 *
 * @returns The created/updated event ID, or null on failure.
 */
export async function writeWorkingLocationEvent(
  userEmail: string,
  date: string,
  location: "home" | "glasgow_office" | "stevenage_office" | "other",
  otherLocation?: string | null,
  existingEventId?: string | null,
): Promise<string | null> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;

  try {
    const calendar = getWritableCalendarClient(userEmail);
    const nextDate = getNextDate(date);

    const eventBody: calendar_v3.Schema$Event = {
      eventType: "workingLocation",
      summary: "Working Location",
      visibility: "public",
      transparency: "transparent",
      start: { date },
      end: { date: nextDate },
      workingLocationProperties: toGoogleWorkingLocationProperties(location, otherLocation),
    };

    if (existingEventId) {
      // Update existing event
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: existingEventId,
        requestBody: eventBody,
      });
      return response.data.id ?? null;
    } else {
      // Create new event
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventBody,
      });
      return response.data.id ?? null;
    }
  } catch (error) {
    logger.warn("Failed to write working location to Calendar", {
      userEmail: maskEmail(userEmail),
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Delete a working location event from the user's Google Calendar.
 */
export async function deleteCalendarEvent(
  userEmail: string,
  eventId: string,
): Promise<boolean> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return false;

  try {
    const calendar = getWritableCalendarClient(userEmail);
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
    return true;
  } catch (error) {
    const apiError = error as { code?: number; message?: string };
    // 404/410 = event already deleted — treat as success
    if (apiError.code === 404 || apiError.code === 410) {
      return true;
    }
    logger.warn("Failed to delete Calendar event", {
      userEmail: maskEmail(userEmail),
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// =============================================
// WRITE-BACK: OOO EVENTS (LEAVE INTEGRATION)
// =============================================

/**
 * Create an Out of Office event in the user's Google Calendar.
 * Called when leave is approved.
 *
 * @returns The created event ID, or null on failure.
 */
export async function createOOOEvent(
  userEmail: string,
  startDate: string,
  endDate: string,
  leaveSummary?: string,
): Promise<string | null> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;

  try {
    const calendar = getWritableCalendarClient(userEmail);
    const nextDate = getNextDate(endDate); // Google uses exclusive end date

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        eventType: "outOfOffice",
        summary: leaveSummary ?? "Out of Office",
        start: { date: startDate },
        end: { date: nextDate },
        outOfOfficeProperties: {
          autoDeclineMode: "declineNone",
        },
        visibility: "public",
        transparency: "opaque",
      },
    });

    return response.data.id ?? null;
  } catch (error) {
    logger.warn("Failed to create OOO event in Calendar", {
      userEmail: maskEmail(userEmail),
      startDate,
      endDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Delete an Out of Office event from the user's Google Calendar.
 * Called when approved leave is cancelled.
 */
export async function deleteOOOEvent(
  userEmail: string,
  eventId: string,
): Promise<boolean> {
  return deleteCalendarEvent(userEmail, eventId);
}

// =============================================
// HELPERS
// =============================================

/** Get the next day (YYYY-MM-DD) — Google Calendar uses exclusive end dates */
function getNextDate(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
