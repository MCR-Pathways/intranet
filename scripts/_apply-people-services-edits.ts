#!/usr/bin/env tsx
/**
 * people-services editorial pass (2026-06-04).
 *
 * Bundle of edits applied to the walker output in one content_json write:
 *
 *   1. Flatten 11 of 12 toggle_v2 to H3 (7 in Policies + 4 in Health &
 *      Safety). The "COSSH Assessments" toggle is kept as toggle_v2 per
 *      the audit decision (MSDS PDFs sit deeply nested; not a dominant
 *      search case). Flattening uses the existing flattenToggleV2
 *      library.
 *
 *   2. Rename the surviving toggle's summary from the walker-preserved
 *      source typo "COSSH Assessments" to the correct "COSHH
 *      Assessments". Affects the on-page label, the toggle's slug if
 *      ever indexed, and the audit doc terminology used elsewhere.
 *
 *   3. Promote the 12 paragraph-with-anchor children of the now-H3
 *      "Employment Policies" section to H4 in-place — each H4 keeps its
 *      inline anchor (so the click still opens the Google Doc) but
 *      gains its own slug/anchor for Cmd+K deep-linking. Pattern:
 *      <p><a>Maternity Policy</a></p> → <h4><a>Maternity Policy</a></h4>.
 *
 *   4. Delete the decorative HR illustration img at the top of the page
 *      (chrome, not load-bearing per the audit; the Plate read view
 *      doesn't need it).
 *
 *   5. Wrap the three Benefits cluster items (Group Life Assurance
 *      Cover / Pension Scheme / Employee Assistance Programme) under a
 *      new H2 "Benefits". The walker emitted them as peer H2s; the
 *      audit IDEAL groups them under a single H2 wrapper with the
 *      individual items demoted to H3.
 *
 * Retained per the "underscore-prefix scratch scripts stay in the repo
 * as audit trail" convention. Re-running is idempotent.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/_apply-people-services-edits.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { flattenToggleV2 } from "@/lib/wp-migration/flatten-toggle-v2";
import type { Database } from "@/types/database.types";
import type { Value } from "platejs";

type Leaf = { text?: unknown };
type Node = { type?: string; children?: unknown[] };

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const x = node as Leaf & Node;
  if (typeof x.text === "string") return x.text;
  if (!Array.isArray(x.children)) return "";
  return (x.children as unknown[]).map((c) => extractText(c)).join("");
}

function hasAnchorChild(node: Node): boolean {
  if (!Array.isArray(node.children)) return false;
  return (node.children as Node[]).some((c) => c.type === "a");
}

const BENEFITS_H2_TEXTS = new Set([
  "group life assurance cover",
  "pension scheme",
  "employee assistance programme (eap)",
]);

interface EditStats {
  flattenedToggles: number;
  excludedToggles: number;
  cosshRenamed: number;
  employmentPolicyChildrenPromoted: number;
  imagesDeleted: number;
  benefitsWrapperAdded: number;
  benefitsH2sDemoted: number;
}

function applyEdits(value: Value): { value: Value; stats: EditStats } {
  const stats: EditStats = {
    flattenedToggles: 0,
    excludedToggles: 0,
    cosshRenamed: 0,
    employmentPolicyChildrenPromoted: 0,
    imagesDeleted: 0,
    benefitsWrapperAdded: 0,
    benefitsH2sDemoted: 0,
  };

  // Step 1: Flatten toggles, excluding COSSH (walker preserved source typo)
  // Exclude BOTH spellings so the script stays idempotent: on the first
  // run the toggle still carries the walker-preserved source typo
  // "COSSH"; step 2 below renames it to "COSHH"; a second run must still
  // recognise it as the keep-as-toggle exception, otherwise the flatten
  // would wrongly collapse the COSHH section.
  const flat = flattenToggleV2(value, {
    summaryHeadingLevel: "h3",
    exclude: ["COSSH Assessments", "COSHH Assessments"],
  });
  stats.flattenedToggles = flat.flattenedCount;
  stats.excludedToggles = flat.skippedCount;

  // Step 2-5: Single linear walk applying the remaining edits.
  const result: Node[] = [];
  let insideEmploymentPolicies = false;
  let benefitsWrapperInserted = false;

  for (const node of flat.value as Node[]) {
    // Step 4: Drop decorative images
    if (node.type === "img") {
      stats.imagesDeleted++;
      continue;
    }

    // Step 2: Rename COSSH → COSHH on the surviving toggle_v2
    if (node.type === "toggle_v2") {
      const summary = (node.children?.[0] as Node | undefined);
      if (summary?.type === "toggle_v2_summary") {
        const summaryText = extractText(summary).trim();
        if (summaryText === "COSSH Assessments") {
          stats.cosshRenamed++;
          const renamedSummary = {
            ...summary,
            children: [{ text: "COSHH Assessments" }],
          };
          const rest = ((node.children ?? []) as Node[]).slice(1);
          result.push({ ...node, children: [renamedSummary, ...rest] });
          continue;
        }
      }
      result.push(node);
      continue;
    }

    // Step 3: Inside-Employment-Policies state machine. The H3 opens the
    // state; any subsequent p that contains an <a> child gets promoted
    // to h4. The state only closes on the next section heading (H2/H3),
    // NOT on any non-anchor node — an interspersed spacer paragraph or
    // intro sentence must not cut the run short and leave later policy
    // links un-promoted. Non-heading non-anchor nodes fall through and
    // are preserved unchanged while the state stays open.
    if (
      node.type === "h3" &&
      extractText(node).trim() === "Employment Policies"
    ) {
      insideEmploymentPolicies = true;
      result.push(node);
      continue;
    }
    if (insideEmploymentPolicies) {
      const isAnchorParagraph =
        node.type === "p" && hasAnchorChild(node as Node);
      if (isAnchorParagraph) {
        stats.employmentPolicyChildrenPromoted++;
        result.push({ ...node, type: "h4" });
        continue;
      }
      // Close the state only on a real section boundary; everything else
      // falls through and is preserved while the state stays open.
      if (node.type === "h2" || node.type === "h3") {
        insideEmploymentPolicies = false;
      }
    }

    // Step 5: Benefits H2 wrapper + demote the three items to H3
    if (node.type === "h2") {
      const headingText = extractText(node).trim().toLowerCase();
      if (BENEFITS_H2_TEXTS.has(headingText)) {
        if (!benefitsWrapperInserted) {
          result.push({
            type: "h2",
            children: [{ text: "Benefits" }],
          });
          stats.benefitsWrapperAdded++;
          benefitsWrapperInserted = true;
        }
        stats.benefitsH2sDemoted++;
        result.push({ ...node, type: "h3" });
        continue;
      }
    }

    result.push(node);
  }

  return { value: result as Value, stats };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    );
    process.exit(2);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let data: {
    id: string;
    slug: string;
    content_json: unknown;
  } | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("id, slug, content_json")
      .eq("slug", "people-services")
      .eq("content_type", "native")
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch people-services:", res.error.message);
      process.exit(1);
    }
    data = res.data;
  } catch (err) {
    console.error(
      "Network error fetching people-services:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!data) {
    console.error("people-services article not found");
    process.exit(1);
  }

  if (!data.content_json || !Array.isArray(data.content_json)) {
    console.error("content_json is missing or not an array");
    process.exit(1);
  }

  const original = data.content_json as Value;
  const { value: final, stats } = applyEdits(original);

  console.log(`${dryRun ? "[dry-run] " : ""}people-services:`);
  console.log(
    `  · flattened ${stats.flattenedToggles} toggle(s) → h3, excluded ${stats.excludedToggles} (COSSH/COSHH stays as toggle)`,
  );
  console.log(`  · renamed ${stats.cosshRenamed} toggle summary "COSSH" → "COSHH"`);
  console.log(
    `  · promoted ${stats.employmentPolicyChildrenPromoted} Employment Policy child paragraph(s) → h4`,
  );
  console.log(`  · deleted ${stats.imagesDeleted} decorative image(s)`);
  console.log(
    `  · inserted ${stats.benefitsWrapperAdded} new H2 "Benefits" wrapper, demoted ${stats.benefitsH2sDemoted} H2 → H3`,
  );

  // List end-state H2/H3/H4 heading sequence for verification
  const endHeadings = (final as Node[])
    .filter((n) => n.type === "h2" || n.type === "h3" || n.type === "h4")
    .map((n) => `${(n.type ?? "?").toUpperCase()} :: ${extractText(n).trim()}`);
  console.log("");
  console.log(`  end-state body headings (${endHeadings.length}):`);
  for (const h of endHeadings) console.log(`    ${h}`);

  if (dryRun) {
    console.log("");
    console.log(
      "[dry-run] No changes written. Re-run without --dry-run to apply.",
    );
    process.exit(0);
  }

  const totalChanges =
    stats.flattenedToggles +
    stats.cosshRenamed +
    stats.employmentPolicyChildrenPromoted +
    stats.imagesDeleted +
    stats.benefitsWrapperAdded;
  if (totalChanges === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  try {
    const { error: updateErr } = await supabase
      .from("resource_articles")
      .update({
        content_json:
          final as unknown as Database["public"]["Tables"]["resource_articles"]["Update"]["content_json"],
      })
      .eq("id", data.id);

    if (updateErr) {
      console.error("Failed to update people-services:", updateErr.message);
      process.exit(1);
    }
  } catch (err) {
    console.error(
      "Network error updating people-services:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  console.log("");
  console.log(
    "Wrote people-services. Next: scripts/reindex-native-article.ts --slug=people-services, then VERIFY.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
