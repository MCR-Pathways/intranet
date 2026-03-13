import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import {
  fetchCategoryArticlesWithClient,
  fetchSubcategoriesWithClient,
} from "../actions";
import { PageHeader, type BreadcrumbItem } from "@/components/layout/page-header";
import { ArticlesList } from "@/components/resources/articles-list";
import { SubcategoryGrid } from "@/components/resources/subcategory-grid";

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit = isHRAdminEffective(profile) || isContentEditorEffective(profile);
  const { category, articles } = await fetchCategoryArticlesWithClient(
    supabase,
    categorySlug,
    canEdit
  );

  if (!category) notFound();

  // Check if this is a parent category with subcategories
  const subcategories = await fetchSubcategoriesWithClient(supabase, category.id);
  const isParentCategory = subcategories.length > 0;

  // Build breadcrumbs — if this is a subcategory, include the parent
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/intranet" },
    { label: "Resources", href: "/resources" },
  ];

  if (category.parent_id) {
    // Fetch parent category name for breadcrumb
    const { data: parent } = await supabase
      .from("resource_categories")
      .select("name, slug")
      .eq("id", category.parent_id)
      .single();

    if (parent) {
      breadcrumbs.push({
        label: parent.name,
        href: `/resources/${parent.slug}`,
      });
    }
  }

  breadcrumbs.push({ label: category.name });

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        subtitle={category.description ?? undefined}
        breadcrumbs={breadcrumbs}
      />

      {isParentCategory ? (
        <SubcategoryGrid subcategories={subcategories} canEdit={canEdit} />
      ) : (
        <ArticlesList
          articles={articles}
          categoryId={category.id}
          categorySlug={category.slug}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
