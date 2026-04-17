import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileEdit, FileText } from "lucide-react";
import {
  getCurrentUser,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchDraftArticles } from "../actions";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          <FileEdit className="h-6 w-6 text-muted-foreground" />
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
        <div className="bg-card rounded-xl border border-border shadow-sm px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-foreground font-medium">No drafts</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start one with &ldquo;+ New article&rdquo; on any category page.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-clip">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-background odd:bg-background">
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Author</TableHead>
                <TableHead className="text-right">Last edited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d) => {
                const categoryPath = d.parent_category_name
                  ? `${d.parent_category_name} / ${d.category_name}`
                  : d.category_name;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/resources/article/${d.slug}`}
                        className="inline-flex items-center gap-2 hover:underline underline-offset-4"
                      >
                        <FileEdit className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{d.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {categoryPath}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {d.author_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right whitespace-nowrap">
                      {formatDate(new Date(d.updated_at))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {drafts.length === 100 && (
            <div className="border-t border-border">
              <p className="px-4 py-3 text-xs text-muted-foreground">
                Showing 100 most recent drafts — older drafts not displayed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
