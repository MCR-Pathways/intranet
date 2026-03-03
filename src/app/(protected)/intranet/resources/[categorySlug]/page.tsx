import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { fetchCategoryArticlesWithClient } from "../actions";
import { PageHeader } from "@/components/layout/page-header";
import { ArticlesList } from "@/components/resources/articles-list";

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const isHRAdmin = isHRAdminEffective(profile);
  const { category, articles } = await fetchCategoryArticlesWithClient(
    supabase,
    categorySlug,
    isHRAdmin
  );

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        subtitle={category.description ?? undefined}
        breadcrumbs={[
          { label: "Intranet", href: "/intranet" },
          { label: "Resources", href: "/intranet/resources" },
          { label: category.name },
        ]}
      />

      <ArticlesList
        articles={articles}
        categoryId={category.id}
        categorySlug={category.slug}
        isHRAdmin={isHRAdmin}
      />
    </div>
  );
}
