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
function getCalendarClient(userEmail: string): calendar_v3.Calendar {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable");
  }

  const keyJson = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"));

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    subject: userEmail, // Domain-wide delegation impersonation
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
      logger.warn("Calendar sync token expired, need full sync", { userEmail });
      return { locations: [], nextSyncToken: null };
    }

    // 403 = delegation not set up or user not in domain
    if (apiError.code === 403) {
      logger.warn("Calendar access denied for user", { userEmail, error: apiError.message });
      return { locations: [], nextSyncToken: null };
    }

    throw error;
  }
}
