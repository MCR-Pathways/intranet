import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly } from "../../actions";
import {
  PageHeader,
  type BreadcrumbItem,
} from "@/components/layout/page-header";
import { ArticleView } from "@/components/resources/article-view";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);

  const { article, category, parentCategory } =
    await fetchArticleBySlugOnly(supabase, slug, canEdit);

  if (!article || !category) notFound();

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/intranet" },
    { label: "Resources", href: "/resources" },
  ];

  if (parentCategory) {
    breadcrumbs.push({
      label: parentCategory.name,
      href: `/resources/${parentCategory.slug}`,
    });
  }

  breadcrumbs.push({
    label: category.name,
    href: `/resources/${category.slug}`,
  });
  breadcrumbs.push({ label: article.title });

  return (
    <div className="space-y-6">
      <PageHeader title={article.title} breadcrumbs={breadcrumbs} />
      <ArticleView
        article={article}
        categoryId={category.id}
        categorySlug={category.slug}
        canEdit={canEdit}
      />
    </div>
  );
}
