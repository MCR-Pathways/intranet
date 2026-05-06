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
        message:
          docs.length > 1
            ? "Documents have expired or are missing — please upload renewals."
            : "A document has expired or is missing — please upload a renewal.",
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
    const { data: managed, error: managedError } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_manager_id", userId);

    if (managedError) {
      logger.warn("getPendingLeaveApprovals managed-profiles query failed", {
        userId,
        error: managedError.message,
      });
      return [];
    }
    const managedIds = (managed ?? []).map((p) => p.id);
    if (managedIds.length === 0) return [];

    const { data: leaves, error: leavesError } = await supabase
      .from("leave_requests")
      .select("id, created_at")
      .in("profile_id", managedIds)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (leavesError) {
      logger.warn("getPendingLeaveApprovals leave_requests query failed", {
        userId,
        error: leavesError.message,
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
        message: "Review and approve or decline.",
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
    const { data: managed, error: managedError } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_manager_id", userId);

    if (managedError) {
      logger.warn("getPendingRTWSignoffs managed-profiles query failed", {
        userId,
        error: managedError.message,
      });
      return [];
    }
    const managedIds = (managed ?? []).map((p) => p.id);
    if (managedIds.length === 0) return [];

    // Bound the historical sweep to the last 6 months. RTW forms should
    // be filed within weeks of the absence ending; anything older is
    // either filed or has aged out of practical reach.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoIso = sixMonthsAgo.toISOString().split("T")[0];

    const { data: absences, error: absencesError } = await supabase
      .from("absence_records")
      .select("id, end_date, total_days")
      .in("profile_id", managedIds)
      .eq("absence_type", "sick")
      .gte("total_days", 3)
      .gte("end_date", sixMonthsAgoIso);

    if (absencesError) {
      logger.warn("getPendingRTWSignoffs absence_records query failed", {
        userId,
        error: absencesError.message,
      });
      return [];
    }
    const triggers = absences ?? [];
    if (triggers.length === 0) return [];

    const triggerIds = triggers.map((a) => a.id);
    const { data: rtws, error: rtwsError } = await supabase
      .from("return_to_work_forms")
      .select("absence_record_id, status")
      .in("absence_record_id", triggerIds);

    if (rtwsError) {
      // Without the locked-rtw set, every trigger absence would falsely
      // appear as outstanding — better to surface zero than over-report.
      logger.warn("getPendingRTWSignoffs return_to_work_forms query failed", {
        userId,
        error: rtwsError.message,
      });
      return [];
    }

    const lockedAbsences = new Set(
      (rtws ?? [])
        .filter((r) => r.status === "locked")
        .map((r) => r.absence_record_id),
    );
    const pending = triggers.filter((a) => !lockedAbsences.has(a.id));
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
        message: "Sickness ≥ 3 days needs an RTW form completed.",
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
 * Today's working location is set to an office but not yet confirmed —
 * surfaces a "confirm arrival" prompt. Date is computed in Europe/London
 * timezone to match the rest of the sign-in flow.
 */
export async function getOfficeArrivalConfirmation(
  supabase: Client,
  userId: string,
): Promise<InboxRow[]> {
  try {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/London",
    }); // YYYY-MM-DD

    const { data, error } = await supabase
      .from("working_locations")
      .select("id, location, confirmed, time_slot")
      .eq("user_id", userId)
      .eq("date", today)
      .in("location", ["glasgow_office", "stevenage_office"])
      .eq("confirmed", false)
      .limit(1);

    if (error) {
      logger.warn("getOfficeArrivalConfirmation query failed", { userId, error: error.message });
      return [];
    }
    const row = (data ?? [])[0];
    if (!row) return [];

    const officeName =
      row.location === "glasgow_office" ? "Glasgow office" : "Stevenage office";

    return [
      {
        id: `state:office_arrival:${userId}:${today}`,
        kind: "state",
        source_kind: NOTIFICATION_SOURCE_KINDS.WORKING_LOCATION,
        source_id: userId,
        type: "office_arrival_unconfirmed",
        title: `Confirm arrival at the ${officeName}`,
        message: "Sign in once you're on site so colleagues can find you.",
        link: "/sign-in",
        created_at: new Date().toISOString(),
        is_cleared: false,
        reason: "Working location",
      },
    ];
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
