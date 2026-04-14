import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileClock, FileText } from "lucide-react";
import {
  getCurrentUser,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchDraftArticles } from "../actions";
import { formatDate } from "@/lib/utils";

export default async function DraftsPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  // Drafts are a content-editor-only view per the approved governance policy.
  // HR admins without the editor flag are redirected out.
  if (!isContentEditorEffective(profile)) redirect("/resources");

  const drafts = await fetchDraftArticles(supabase);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Resources
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileClock className="h-6 w-6 text-amber-500" />
          Drafts
          <span className="text-base font-normal text-muted-foreground">
            ({drafts.length})
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unpublished articles. Visible only to content editors.
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-sm px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-foreground font-medium">No drafts</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start one with &ldquo;+ New article&rdquo; on any category page.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <div className="col-span-5">Title</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-2">Author</div>
            <div className="col-span-2">Last edited</div>
          </div>
          <ul>
            {drafts.map((d, i) => {
              const categoryPath = d.parent_category_name
                ? `${d.parent_category_name} / ${d.category_name}`
                : d.category_name;
              return (
                <li
                  key={d.id}
                  className={
                    i % 2 === 1 ? "bg-muted/20" : undefined
                  }
                >
                  <Link
                    href={`/resources/article/${d.slug}`}
                    className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm hover:bg-muted transition-colors"
                  >
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      <FileClock className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="font-medium truncate">{d.title}</span>
                    </div>
                    <div className="col-span-3 text-muted-foreground truncate">
                      {categoryPath}
                    </div>
                    <div className="col-span-2 text-muted-foreground truncate">
                      {d.author_name ?? "—"}
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      {formatDate(new Date(d.updated_at))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
