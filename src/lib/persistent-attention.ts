/**
 * Persistent-state attention helpers.
 *
 * Per the W3-rev locked scope: some inbox items are NOT stored as rows in
 * the notifications table — they're computed from underlying state at
 * render time. When the state changes, the item disappears naturally
 * (no auto-Clear hook needed because there's no DB row to clear).
 *
 * Each helper returns InboxRow[] — usually 0 or 1 row per call, since we
 * group multiple matching records into a single row with a `count` field
 * ("3 leave requests waiting" rather than 3 separate rows).
 *
 * Server-only — uses the user's Supabase client (passed in) rather than
 * the service-role client. Each helper is intentionally read-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { InboxRow } from "@/types/notification";
import { NOTIFICATION_SOURCE_KINDS } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { getDailyBannerState } from "@/app/(protected)/sign-in/actions";

type Client = SupabaseClient<Database>;

/**
 * Compliance documents that have expired or are missing for the current
 * user. Grouped into one row with a count.
 */
export async function getOverdueCompliance(
  supabase: Client,
  userId: string,
): Promise<InboxRow[]> {
  try {
    const { data, error } = await supabase
      .from("compliance_documents")
      .select("id, expiry_date, status")
      .eq("profile_id", userId)
      .in("status", ["expired", "missing"]);

    if (error) {
      logger.warn("getOverdueCompliance query failed", { userId, error: error.message });
      return [];
    }
    const docs = data ?? [];
    if (docs.length === 0) return [];

    // Sort by oldest expiry so the row's created_at points at the most-overdue item.
    const oldest = docs
      .map((d) => d.expiry_date)
      .filter((d): d is string => d !== null)
      .sort()[0];

    return [
      {
        id: `state:compliance_overdue:${userId}`,
        kind: "state",
        source_kind: NOTIFICATION_SOURCE_KINDS.COMPLIANCE_ASSIGNMENT,
        source_id: userId,
        type: "compliance_overdue",
        title:
          docs.length > 1
            ? `${docs.length} compliance documents need attention`
            : "1 compliance document needs attention",
        message: "",
        link: "/hr/compliance",
        created_at: oldest ?? new Date().toISOString(),
        is_cleared: false,
        reason: "Compliance",
        count: docs.length,
      },
    ];
  } catch (err) {
    logger.warn("getOverdueCompliance threw", { userId, error: err });
    return [];
  }
}

/**
 * Leave requests pending the current user's approval (manager-only).
 * Returns 0 rows for non-managers.
 */
export async function getPendingLeaveApprovals(
  supabase: Client,
  userId: string,
): Promise<InboxRow[]> {
  try {
    // One query: filter leave_requests by joined profile's line_manager_id.
    // Cuts a round trip vs the older managed-profiles → leave-requests pair.
    const { data: leaves, error } = await supabase
      .from("leave_requests")
      .select("id, created_at, profiles!leave_requests_profile_id_fkey!inner(line_manager_id)")
      .eq("profiles.line_manager_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      logger.warn("getPendingLeaveApprovals query failed", {
        userId,
        error: error.message,
      });
      return [];
    }
    const pending = leaves ?? [];
    if (pending.length === 0) return [];

    return [
      {
        id: `state:leave_pending:${userId}`,
        kind: "state",
        source_kind: NOTIFICATION_SOURCE_KINDS.LEAVE_REQUEST,
        source_id: userId,
        type: "pending_leave_approval",
        title:
          pending.length > 1
            ? `${pending.length} leave requests waiting for your approval`
            : "1 leave request waiting for your approval",
        message: "",
        link: "/hr/leave",
        created_at: pending[0]?.created_at ?? new Date().toISOString(),
        is_cleared: false,
        reason: "Leave request",
        count: pending.length,
      },
    ];
  } catch (err) {
    logger.warn("getPendingLeaveApprovals threw", { userId, error: err });
    return [];
  }
}

/**
 * RTW forms the manager owes for subordinate sickness ≥ 3 days. Counts
 * absences without a locked RTW.
 */
export async function getPendingRTWSignoffs(
  supabase: Client,
  userId: string,
): Promise<InboxRow[]> {
  try {
    // Bound the historical sweep to the last 6 months. RTW forms should
    // be filed within weeks of the absence ending; anything older is
    // either filed or has aged out of practical reach.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoIso = sixMonthsAgo.toISOString().split("T")[0];

    // One query: filter sick absences ≥ 3 days for users this manager owns,
    // and embed the related RTW forms so we can do the locked-vs-not check
    // in JS. Cuts two round trips vs the older managed-profiles → absences
    // → RTW chain.
    const { data: absences, error } = await supabase
      .from("absence_records")
      .select(
        "id, end_date, total_days, profiles!absence_records_profile_id_fkey!inner(line_manager_id), return_to_work_forms(status)",
      )
      .eq("profiles.line_manager_id", userId)
      .eq("absence_type", "sick")
      .gte("total_days", 3)
      .gte("end_date", sixMonthsAgoIso);

    if (error) {
      logger.warn("getPendingRTWSignoffs query failed", {
        userId,
        error: error.message,
      });
      return [];
    }

    // Supabase infers return_to_work_forms as a singular object (1:1 via
    // the unique-constrained absence_record_id FK). An absence is
    // "outstanding" when there's no RTW form yet, OR when one exists but
    // hasn't been locked.
    const pending = (absences ?? []).filter(
      (a) => a.return_to_work_forms?.status !== "locked",
    );
    if (pending.length === 0) return [];

    const oldestEndDate = pending
      .map((a) => a.end_date)
      .sort()[0];

    return [
      {
        id: `state:rtw_pending:${userId}`,
        kind: "state",
        source_kind: NOTIFICATION_SOURCE_KINDS.RTW_FORM,
        source_id: userId,
        type: "pending_rtw_signoff",
        title:
          pending.length > 1
            ? `${pending.length} return-to-work forms outstanding`
            : "1 return-to-work form outstanding",
        message: "",
        link: "/hr/absence",
        created_at: oldestEndDate ?? new Date().toISOString(),
        is_cleared: false,
        reason: "Return to work",
        count: pending.length,
      },
    ];
  } catch (err) {
    logger.warn("getPendingRTWSignoffs threw", { userId, error: err });
    return [];
  }
}

/**
 * Working-location prompts. Two cases, both surface as state-rows in
 * the inbox:
 *
 *   - "Where are you working today?" — user has no working_location row
 *     for today (and it's before 2pm UK; getDailyBannerState gates this).
 *   - "Confirm office arrival" — user is scheduled for an office but
 *     hasn't confirmed they're on site (after 9:30am UK).
 *
 * Defers all the time-of-day and state-detection logic to
 * getDailyBannerState in sign-in/actions — same source of truth as the
 * DailyBanner so the bell and the banner can never disagree.
 */
export async function getOfficeArrivalConfirmation(
  // supabase is unused but kept in the signature so the helper composes
  // with getAllPersistentAttention's parallel-fetch shape unchanged.
  _supabase: Client,
  userId: string,
): Promise<InboxRow[]> {
  try {
    const { type } = await getDailyBannerState();
    if (!type) return [];

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/London",
    });

    if (type === "no_schedule") {
      return [
        {
          id: `state:no_location:${userId}:${today}`,
          kind: "state",
          source_kind: NOTIFICATION_SOURCE_KINDS.WORKING_LOCATION,
          source_id: userId,
          type: "no_location_set",
          title: "Where are you working today?",
          message: "",
          link: "/sign-in",
          created_at: new Date().toISOString(),
          is_cleared: false,
          reason: "Working location",
        },
      ];
    }

    if (type === "office_not_confirmed") {
      return [
        {
          id: `state:office_arrival:${userId}:${today}`,
          kind: "state",
          source_kind: NOTIFICATION_SOURCE_KINDS.WORKING_LOCATION,
          source_id: userId,
          type: "office_arrival_unconfirmed",
          title: "Confirm your office arrival",
          message: "",
          link: "/sign-in",
          created_at: new Date().toISOString(),
          is_cleared: false,
          reason: "Working location",
        },
      ];
    }

    return [];
  } catch (err) {
    logger.warn("getOfficeArrivalConfirmation threw", { userId, error: err });
    return [];
  }
}

/**
 * Run all four persistent-attention helpers in parallel and return their
 * combined output. The caller (getInboxStream) merges this with DB
 * notifications.
 */
export async function getAllPersistentAttention(
  supabase: Client,
  userId: string,
): Promise<InboxRow[]> {
  const results = await Promise.all([
    getOverdueCompliance(supabase, userId),
    getPendingLeaveApprovals(supabase, userId),
    getPendingRTWSignoffs(supabase, userId),
    getOfficeArrivalConfirmation(supabase, userId),
  ]);
  return results.flat();
}
