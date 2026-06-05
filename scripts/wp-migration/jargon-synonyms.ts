#!/usr/bin/env tsx
/**
 * Harvest two-way Algolia synonyms from the migrated `jargon` glossary so Cmd+K
 * treats an acronym and its expansion as interchangeable (search "SDS" → finds
 * "Skills Development Scotland" content, and vice versa).
 *
 * Sources, in priority order:
 *   1. Acronyms glossary (variant:"acronyms"): term = the acronym, definition's
 *      leading phrase = the expansion.
 *   2. Terms glossary (variant:"terms"): a term whose NAME carries a parenthetical
 *      abbreviation, e.g. "Compulsory Supervision Order (CSO)" → CSO.
 *
 * Pairs are pushed to the `resources_articles` index as two-way synonyms with
 * stable objectIDs (jargon-syn-<abbr>), so re-running updates rather than
 * duplicates. Index-wide by design — these are org abbreviations, useful on any
 * resources search, not just the jargon page.
 *
 * Dry-run by default (prints the pairs and flags questionable ones). Pass --write
 * to push to Algolia.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/wp-migration/jargon-synonyms.ts
 *   node --env-file=.env.local --import tsx scripts/wp-migration/jargon-synonyms.ts --write
 */
import { createClient } from "@supabase/supabase-js";
import { algoliasearch } from "algoliasearch";
import type { Database } from "@/types/database.types";

const SLUG = "jargon";
const INDEX = "resources_articles";

type Node = { type?: string; variant?: string; children?: unknown[]; [k: string]: unknown };

/** Recursively join a node's text leaves. */
function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown[] };
  if (typeof n.text === "string") return n.text;
  if (!Array.isArray(n.children)) return "";
  return n.children.map(nodeText).join("");
}

/** The leading expansion phrase of a definition: up to the first sentence end,
 *  trimmed. "Additional Support Needs. Under the guidance…" → "Additional
 *  Support Needs". A definition with no full stop is taken whole. */
function expansion(def: string): string {
  const s = def.trim();
  // Quoted expansion: 'Looked After Child' You may hear… → Looked After Child
  const quoted = s.match(/^[‘'"]\s*([^’'"]+?)\s*[’'"]/);
  if (quoted) return quoted[1].replace(/\s+/g, " ").trim();
  // Otherwise cut at the first explanation boundary: "(", " is ", or a full stop.
  const cut = s.search(/\s*\(|\s+is\s+|\.(\s|$)/);
  const head = cut === -1 ? s : s.slice(0, cut);
  return head.replace(/\s+/g, " ").trim();
}

type Pair = { abbr: string; expansion: string; from: string; flag?: string };

/** A clean acronym is short, mostly capitals/digits, no spaces. Flags compound
 *  forms (containing "/") and anything that looks like a phrase, not an abbr. */
function flagFor(abbr: string, exp: string): string | undefined {
  if (!abbr || !exp) return "empty side";
  if (abbr.includes("/")) return "compound acronym (e.g. LAC/LAAC) — review split";
  if (abbr.length > 10) return "abbr unusually long — is it really an acronym?";
  if (/\s/.test(abbr)) return "abbr contains a space — likely not an acronym";
  if (exp.length > 60) return "expansion long — may carry explanation, not just the words";
  return undefined;
}

function entryTermAndDef(entry: Node): { term: string; def: string } {
  const kids = (entry.children ?? []) as Node[];
  return { term: nodeText(kids[0]).trim(), def: nodeText(kids[1]).trim() };
}

function harvest(nodes: Node[]): Pair[] {
  const pairs: Pair[] = [];
  for (const node of nodes) {
    if (node.type !== "glossary") continue;
    const variant = node.variant;
    for (const entry of (node.children ?? []) as Node[]) {
      if (entry.type !== "glossary_entry") continue;
      const { term, def } = entryTermAndDef(entry);

      if (variant === "acronyms") {
        // Compound acronym (X/Y) with a matching multi-part expansion → split
        // into one pair each (YST/YT → YST⇄Young Scottish Talent, YT⇄Young Talent).
        if (term.includes("/")) {
          const abbrs = term.split("/").map((a) => a.trim());
          const exps = expansion(def)
            .replace(/,\s*or\s+/gi, "/")
            .split("/")
            .map((e) => e.trim());
          if (abbrs.length === exps.length && abbrs.every((a, i) => a && exps[i])) {
            abbrs.forEach((a, i) =>
              pairs.push({
                abbr: a,
                expansion: exps[i],
                from: "Acronyms (split)",
                flag: flagFor(a, exps[i]),
              }),
            );
            continue;
          }
        }
        const exp = expansion(def);
        pairs.push({ abbr: term, expansion: exp, from: "Acronyms", flag: flagFor(term, exp) });
        continue;
      }

      // Terms: only mine a parenthetical abbreviation in the term NAME, e.g.
      // "Compulsory Supervision Order (CSO)". The base term (sans parenthetical)
      // is the expansion.
      const m = term.match(/^(.*?)\s*\(([A-Za-z][A-Za-z0-9/]{1,9})\)\s*$/);
      if (m) {
        const base = m[1].replace(/[\s—–-]+$/, "").trim();
        const abbr = m[2].trim();
        pairs.push({ abbr, expansion: base, from: "Terms (paren)", flag: flagFor(abbr, base) });
      }
    }
  }
  return pairs;
}

function synObjectId(abbr: string): string {
  return `jargon-syn-${abbr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

async function main() {
  const write = process.argv.includes("--write");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }
  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let json: unknown;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("content_json")
      .eq("slug", SLUG)
      .eq("content_type", "native")
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch jargon:", res.error.message);
      process.exit(1);
    }
    if (!res.data) {
      console.error("jargon article not found");
      process.exit(1);
    }
    json = res.data.content_json;
  } catch (err) {
    console.error("Network error fetching jargon:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  if (!Array.isArray(json)) {
    console.error("content_json is not an array (run migrate-jargon first)");
    process.exit(1);
  }

  const all = harvest(json as Node[]);
  // Dedupe by objectID (abbr), keeping the first (Acronyms beat Terms parens).
  const seen = new Set<string>();
  const pairs = all.filter((p) => {
    const id = synObjectId(p.abbr);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const clean = pairs.filter((p) => !p.flag);
  const flagged = pairs.filter((p) => p.flag);

  console.log(`=== ${clean.length} clean synonym pairs ===`);
  clean.forEach((p) => console.log(`  ${p.abbr}  ⇄  ${p.expansion}   [${p.from}]`));
  if (flagged.length) {
    console.log(`\n=== ${flagged.length} flagged (excluded unless reviewed) ===`);
    flagged.forEach((p) => console.log(`  ${p.abbr}  ⇄  ${p.expansion}   [${p.from}] — ${p.flag}`));
  }

  if (!write) {
    console.log(`\nDry-run only. ${clean.length} clean pairs would be pushed to "${INDEX}". Re-run with --write.`);
    return;
  }

  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID?.trim();
  const adminKey = process.env.ALGOLIA_ADMIN_KEY?.trim();
  if (!appId || !adminKey) {
    console.error("Missing NEXT_PUBLIC_ALGOLIA_APP_ID or ALGOLIA_ADMIN_KEY");
    process.exit(2);
  }
  const client = algoliasearch(appId, adminKey);
  const synonymHit = clean.map((p) => ({
    objectID: synObjectId(p.abbr),
    type: "synonym" as const,
    synonyms: [p.abbr, p.expansion],
  }));
  try {
    await client.saveSynonyms({ indexName: INDEX, synonymHit });
    console.log(`\nPushed ${synonymHit.length} synonyms to "${INDEX}".`);
  } catch (err) {
    console.error("\nAlgolia saveSynonyms failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
