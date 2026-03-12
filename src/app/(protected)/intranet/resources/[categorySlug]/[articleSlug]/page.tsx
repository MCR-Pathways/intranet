import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import { fetchArticleWithClient } from "../../actions";
import { PageHeader } from "@/components/layout/page-header";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={article.title}
        breadcrumbs={[
          { label: "Home", href: "/intranet" },
          { label: "Resources", href: "/intranet/resources" },
          { label: category.name, href: `/intranet/resources/${category.slug}` },
          { label: article.title },
        ]}
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
