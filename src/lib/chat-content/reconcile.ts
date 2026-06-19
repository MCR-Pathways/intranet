// Server-only: uses the service-role client to write course shells. Never
// import in a client component.
import { createServiceClient } from "@/lib/supabase/service";
import { listIntranetHubCourses } from "@/lib/chat-content/queries";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

/**
 * Reconciles the live Chat hub catalogue into native `courses` shells.
 *
 * Hub courses are authored in the external Chat project; the intranet mirrors
 * each one into a local `courses` row (source='hub') so learners enrol, get
 * certificates, and appear in reports against a native record. This sync runs
 * on a daily cron (migration 00101) and on a manual admin trigger.
 *
 * Per course:
 *   - existing shell  → UPDATE the upstream-owned fields (title, description,
 *     duration_minutes) and re-activate it. Admin-owned fields (category,
 *     is_required, issue_certificate, status) are left untouched.
 *   - no shell yet    → INSERT a published, active shell with sensible
 *     defaults the admin can later edit.
 * Any existing hub shell whose source_course_id is no longer in the live Chat
 * set is deactivated (is_active=false) rather than deleted, so completions and
 * certificates are retained.
 *
 * Each course's work is wrapped in its own try/catch: one bad course pushes a
 * message to blockErrors and the loop continues. The function never throws out
 * of the loop. Uses the service client to bypass RLS for the writes.
 */
export async function reconcileHubCourses(): Promise<{
  inserted: number;
  updated: number;
  deactivated: number;
  blockErrors: string[];
}> {
  const supabase = createServiceClient();
  const blockErrors: string[] = [];
  let inserted = 0;
  let updated = 0;
  let deactivated = 0;

  // Live Chat catalogue destined for the intranet hub.
  const hubCourses = await listIntranetHubCourses();

  // Existing local hub shells, keyed by the originating Chat course id.
  const { data: existingRows, error: existingErr } = await supabase
    .from("courses")
    .select("id, source_course_id, is_active")
    .eq("source", "hub");

  if (existingErr) {
    logger.error("Failed to load existing hub course shells", {
      error: existingErr.message,
    });
    throw new Error("Failed to load existing hub course shells");
  }

  const existingBySourceId = new Map<
    string,
    { id: string; source_course_id: string | null; is_active: boolean | null }
  >();
  for (const row of existingRows ?? []) {
    if (row.source_course_id) {
      existingBySourceId.set(row.source_course_id, row);
    }
  }

  const liveSourceIds = new Set<string>();

  // ── Upsert each live Chat course into a local shell ─────────────
  for (const course of hubCourses) {
    liveSourceIds.add(course.id);

    try {
      const existing = existingBySourceId.get(course.id);

      if (existing) {
        const updatePayload: Database["public"]["Tables"]["courses"]["Update"] =
          {
            title: course.title,
            description: course.description,
            duration_minutes: course.estimated_duration_minutes,
            is_active: true,
          };

        const { error } = await supabase
          .from("courses")
          .update(updatePayload)
          .eq("id", existing.id);

        if (error) throw error;
        updated += 1;
      } else {
        const insertPayload: Database["public"]["Tables"]["courses"]["Insert"] =
          {
            source: "hub",
            source_course_id: course.id,
            title: course.title,
            description: course.description,
            duration_minutes: course.estimated_duration_minutes,
            category: "upskilling",
            status: "published",
            is_active: true,
            is_required: false,
            issue_certificate: true,
          };

        const { error } = await supabase.from("courses").insert(insertPayload);

        if (error) throw error;
        inserted += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Failed to reconcile hub course", {
        sourceCourseId: course.id,
        error: message,
      });
      blockErrors.push(`${course.id}: ${message}`);
    }
  }

  // ── Deactivate shells no longer present in the live Chat set ────
  for (const row of existingRows ?? []) {
    if (!row.source_course_id) continue;
    if (liveSourceIds.has(row.source_course_id)) continue;
    // Already hidden — nothing to do.
    if (row.is_active === false) continue;

    try {
      const deactivatePayload: Database["public"]["Tables"]["courses"]["Update"] =
        {
          is_active: false,
        };

      const { error } = await supabase
        .from("courses")
        .update(deactivatePayload)
        .eq("id", row.id);

      if (error) throw error;
      deactivated += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Failed to deactivate stale hub course shell", {
        courseId: row.id,
        sourceCourseId: row.source_course_id,
        error: message,
      });
      blockErrors.push(`${row.source_course_id} (deactivate): ${message}`);
    }
  }

  logger.info("Hub course reconciliation complete", {
    inserted,
    updated,
    deactivated,
    blockErrorCount: blockErrors.length,
  });

  return { inserted, updated, deactivated, blockErrors };
}
