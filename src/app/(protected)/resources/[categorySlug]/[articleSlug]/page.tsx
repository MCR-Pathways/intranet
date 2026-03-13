import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import { fetchArticleWithClient, fetchParentCategory } from "../../actions";
import { PageHeader, type BreadcrumbItem } from "@/components/layout/page-header";
import { ArticleView } from "@/components/resources/article-view";

interface ArticlePageProps {
  params: Promise<{ categorySlug: string; articleSlug: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { categorySlug, articleSlug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit = isHRAdminEffective(profile) || isContentEditorEffective(profile);
  const { category, article } = await fetchArticleWithClient(
    supabase,
    categorySlug,
    articleSlug,
    canEdit
  );

  if (!category || !article) notFound();

  // Build breadcrumbs — if category is a subcategory, include parent
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/intranet" },
    { label: "Resources", href: "/resources" },
  ];

  if (category.parent_id) {
    const parent = await fetchParentCategory(supabase, category.parent_id);
    if (parent) {
      breadcrumbs.push({ label: parent.name, href: `/resources/${parent.slug}` });
    }
  }

  breadcrumbs.push({ label: category.name, href: `/resources/${category.slug}` });
  breadcrumbs.push({ label: article.title });

  return (
    <div className="space-y-6">
      <PageHeader
        title={article.title}
        breadcrumbs={breadcrumbs}
      />

      <ArticleView
        article={article}
        categoryId={category.id}
        categorySlug={category.slug}
        canEdit={canEdit}
      />
    </div>
  );
}
