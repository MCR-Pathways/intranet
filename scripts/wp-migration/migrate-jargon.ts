#!/usr/bin/env tsx
/**
 * Migrate the `jargon` article from the WordPress shape (flat paragraphs, each
 * term a paragraph carrying an empty-href jump anchor, followed by its
 * definition paragraph) into the native `glossary` block shape locked in
 * memory/wp-migration-design-audit.md:
 *
 *   intro paragraphs
 *   h2 "Terms"     + glossary{variant:"terms"}     (one glossary_entry per term)
 *   h2 "Acronyms"  + glossary{variant:"acronyms"}  (one glossary_entry per term)
 *
 * Each glossary_entry is [glossary_term, glossary_definition]. The dead WP jump
 * anchors (<a> with no href) are dropped; the term keeps its inline text and any
 * bold/italic marks. Definitions keep their inline content too.
 *
 * Dry-run by default — prints the full extraction and any anomalies, writes
 * nothing. Pass --write to update content_json in the database. Algolia
 * reindexing is a separate, deliberate step (re-publish the article) once the
 * content is verified.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/wp-migration/migrate-jargon.ts
 *   node --env-file=.env.local --import tsx scripts/wp-migration/migrate-jargon.ts --write
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Node = { type?: string; children?: unknown[]; url?: unknown; [k: string]: unknown };

const SLUG = "jargon";
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * Editorial corrections applied on top of the faithful migration (Colin,
 * 2026-06-05). Each `find` is an exact source phrase so it can't over-match
 * (e.g. "with the YST program" won't touch "programme" elsewhere).
 */
const CORRECTIONS: Array<{ find: string; replace: string }> = [
  { find: "relevant taff in England", replace: "relevant staff in England" },
  { find: "a young persons Guidance Teacher", replace: "a young person’s Guidance Teacher" },
  { find: "with the YST program", replace: "with the YST programme" },
  { find: "a young person looked after status", replace: "a young person’s looked-after status" },
  {
    find: "the mentor pipelines MCR Motivated, committed, resilient",
    replace: "the mentor pipelines.",
  },
];

/** A term paragraph is a <p> that contains an <a> (the WP jump anchor). */
function isAnchorParagraph(node: Node): boolean {
  if (node.type !== "p" || !Array.isArray(node.children)) return false;
  return node.children.some((c) => (c as Node)?.type === "a");
}

/** Drop <a> wrappers but keep their inline children, so a term loses its dead
 *  anchor while keeping its text and marks. Recurses through any nesting. */
function stripAnchors(children: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const child of children) {
    const n = child as Node;
    if (n?.type === "a" && Array.isArray(n.children)) {
      out.push(...stripAnchors(n.children));
    } else if (Array.isArray(n?.children)) {
      out.push({ ...n, children: stripAnchors(n.children) });
    } else {
      out.push(child);
    }
  }
  return out;
}

function inlineText(children: unknown[]): string {
  return children
    .map((c) => {
      const n = c as Node & { text?: string };
      if (typeof n?.text === "string") return n.text;
      if (Array.isArray(n?.children)) return inlineText(n.children);
      return "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

type Entry = { term: unknown[]; def: unknown[]; termText: string; defText: string };

/** Apply the editorial CORRECTIONS to every text leaf (recursively). The find
 *  phrases are exact, so running over the whole subtree is safe. */
function applyCorrections(children: unknown[]): unknown[] {
  return children.map((c) => {
    if (!c || typeof c !== "object") return c;
    const n = c as { text?: unknown; children?: unknown[] };
    if (typeof n.text === "string") {
      let t = n.text;
      for (const { find, replace } of CORRECTIONS) t = t.split(find).join(replace);
      return { ...n, text: t };
    }
    if (Array.isArray(n.children)) return { ...n, children: applyCorrections(n.children) };
    return c;
  });
}

function buildEntry(termChildren: unknown[], defParagraphs: unknown[][]): Entry {
  const term = applyCorrections(stripAnchors(termChildren));
  // Join multi-paragraph definitions with a separating space leaf so the
  // glossary_definition stays a single inline run.
  const def: unknown[] = [];
  defParagraphs.forEach((p, i) => {
    if (i > 0) def.push({ text: " " });
    def.push(...applyCorrections(p));
  });
  return {
    term,
    def,
    termText: inlineText(term),
    defText: inlineText(def),
  };
}

function parseSection(nodes: Node[]): { entries: Entry[]; anomalies: string[] } {
  const entries: Entry[] = [];
  const anomalies: string[] = [];
  let termChildren: unknown[] | null = null;
  let defParagraphs: unknown[][] = [];

  const flush = () => {
    if (termChildren === null) return;
    if (defParagraphs.length === 0) {
      anomalies.push(`Term "${inlineText(termChildren)}" has no definition.`);
    }
    if (defParagraphs.length > 1) {
      anomalies.push(
        `Term "${inlineText(termChildren)}" has ${defParagraphs.length} definition paragraphs (joined).`,
      );
    }
    entries.push(buildEntry(termChildren, defParagraphs));
    termChildren = null;
    defParagraphs = [];
  };

  for (const node of nodes) {
    if (isAnchorParagraph(node)) {
      flush();
      termChildren = node.children ?? [];
    } else if (node.type === "p") {
      if (termChildren === null) {
        anomalies.push(`Orphan paragraph before any term: "${inlineText(node.children ?? [])}".`);
      } else {
        defParagraphs.push(node.children ?? []);
      }
    } else {
      anomalies.push(`Unexpected node type "${node.type}" inside a section (skipped).`);
    }
  }
  flush();
  return { entries, anomalies };
}

function glossaryEntryNode(entry: Entry): Node {
  return {
    type: "glossary_entry",
    children: [
      { type: "glossary_term", children: entry.term.length ? entry.term : [{ text: "" }] },
      { type: "glossary_definition", children: entry.def.length ? entry.def : [{ text: "" }] },
    ],
  };
}

async function main() {
  const write = process.argv.includes("--write");
  const full = process.argv.includes("--full");
  const fromBackup = process.argv.includes("--from-backup");
  const backupPath = "scripts/wp-migration/_jargon-content-backup.json";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(2);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let row: { id: string; slug: string; content_json: unknown } | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("id, slug, content_json")
      .eq("slug", SLUG)
      .eq("content_type", "native")
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch jargon:", res.error.message);
      process.exit(1);
    }
    row = res.data;
  } catch (err) {
    console.error(
      "Network error fetching jargon:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
  if (!row) {
    console.error("jargon article not found");
    process.exit(1);
  }
  // Source: the live DB by default, or the backup file for a corrected re-run
  // (the DB already holds migrated glossary blocks, which can't be re-parsed).
  let json: unknown;
  if (fromBackup) {
    try {
      json = JSON.parse(readFileSync(backupPath, "utf8"));
    } catch (err) {
      console.error(
        `Failed to read backup file at ${backupPath}:`,
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }
  } else {
    json = row.content_json;
  }
  if (!Array.isArray(json)) {
    console.error(fromBackup ? "backup file is not an array" : "content_json is not an array");
    process.exit(1);
  }

  const nodes = json as Node[];

  // Split into: intro (before first heading), then sections keyed by heading text.
  const intro: Node[] = [];
  const sections: Array<{ heading: string; nodes: Node[] }> = [];
  let current: { heading: string; nodes: Node[] } | null = null;
  for (const node of nodes) {
    if (HEADINGS.has(node.type ?? "")) {
      current = { heading: inlineText(node.children ?? []), nodes: [] };
      sections.push(current);
    } else if (current) {
      current.nodes.push(node);
    } else {
      intro.push(node);
    }
  }

  const variantFor = (heading: string): "terms" | "acronyms" =>
    /acronym/i.test(heading) ? "acronyms" : "terms";

  const parsed = sections.map((section) => {
    const { entries, anomalies } = parseSection(section.nodes);
    return {
      heading: section.heading,
      variant: variantFor(section.heading),
      entries,
      anomalies,
    };
  });

  // Dedupe cross-section duplicates: keep the FIRST occurrence (Terms precedes
  // Acronyms in document order) and drop later copies. Colin's call 2026-06-05:
  // Group 1, Group 2 and Pulse keep their Terms entry; the Acronyms copies come
  // out. For Pulse the Terms definition already subsumes the Acronyms one, so the
  // merge loses nothing.
  const seen = new Set<string>();
  const keptDefByTerm = new Map<string, string>();
  const dropped: Array<{ term: string; from: string; keptDef: string; droppedDef: string }> = [];
  for (const p of parsed) {
    p.entries = p.entries.filter((e) => {
      const key = e.termText.toLowerCase();
      if (seen.has(key)) {
        dropped.push({
          term: e.termText,
          from: p.heading,
          keptDef: keptDefByTerm.get(key) ?? "",
          droppedDef: e.defText,
        });
        return false;
      }
      seen.add(key);
      keptDefByTerm.set(key, e.defText);
      return true;
    });
  }

  const newContent: Node[] = [...intro.map((n) => ({ ...n }))];
  const allAnomalies: string[] = [];
  const summary: Array<{ heading: string; variant: string; count: number }> = [];

  for (const p of parsed) {
    allAnomalies.push(...p.anomalies.map((a) => `[${p.heading}] ${a}`));
    summary.push({ heading: p.heading, variant: p.variant, count: p.entries.length });
    newContent.push({ type: "h2", children: [{ text: p.heading }] });
    newContent.push({ type: "glossary", variant: p.variant, children: p.entries.map(glossaryEntryNode) });

    console.log(`\n=== ${p.heading} (variant: ${p.variant}) — ${p.entries.length} entries ===`);
    p.entries.forEach((e, i) => {
      const def = full ? e.defText : e.defText.length > 80 ? e.defText.slice(0, 77) + "..." : e.defText;
      console.log(`  ${String(i + 1).padStart(2)}. ${e.termText}  ::  ${def}`);
    });
  }

  if (dropped.length) {
    console.log(`\n=== Deduped: ${dropped.length} duplicate(s) dropped from later sections ===`);
    for (const d of dropped) {
      console.log(`"${d.term}" — removed from ${d.from}, kept the Terms entry.`);
      console.log(`  kept (Terms):      ${d.keptDef}`);
      console.log(`  dropped (${d.from}): ${d.droppedDef}`);
      console.log("");
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Intro paragraphs: ${intro.length}`);
  summary.forEach((s) => console.log(`${s.heading}: ${s.count} entries (${s.variant})`));
  const totalEntries = summary.reduce((a, s) => a + s.count, 0);
  console.log(`Total entries: ${totalEntries} (${totalEntries + dropped.length} source terms − ${dropped.length} deduped)`);

  if (allAnomalies.length) {
    console.log(`\n=== Anomalies (${allAnomalies.length}) ===`);
    allAnomalies.forEach((a) => console.log(`  - ${a}`));
  } else {
    console.log("\nNo anomalies — clean term/definition pairing throughout.");
  }

  if (!write) {
    console.log("\nDry-run only. Re-run with --write to update content_json.");
    return;
  }

  // Back up the original content_json first, but only when reading the live DB.
  // A --from-backup re-run must NOT overwrite the good backup with already-
  // migrated data. This migration is NOT idempotent (it reads WP-shape
  // paragraphs and overwrites them), so the backup is the restore path.
  if (!fromBackup) {
    writeFileSync(backupPath, JSON.stringify(json, null, 2));
    console.log(`Backed up original content_json (${json.length} nodes) to ${backupPath}`);
  }

  try {
    const { error: updateError } = await supabase
      .from("resource_articles")
      .update({
        content_json:
          newContent as unknown as Database["public"]["Tables"]["resource_articles"]["Update"]["content_json"],
      })
      .eq("id", row.id);
    if (updateError) {
      console.error("\nFailed to write content_json:", updateError.message);
      process.exit(1);
    }
  } catch (err) {
    console.error(
      "\nNetwork error writing content_json:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
  console.log(`\nWrote new content_json (${newContent.length} top-level nodes) to jargon.`);
  console.log(
    "Next: run scripts/reindex-native-article.ts --slug=jargon to refresh the Algolia per-term records. The article page is dynamic (auth-gated), so it renders the new content on the next request.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
