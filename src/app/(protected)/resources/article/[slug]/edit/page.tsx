import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly } from "../../../actions";
import { NativeArticleEditor } from "@/components/resources/native-article-editor";

interface EditArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const { slug } = await params;
  const { user, profile, supabase } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);
  if (!canEdit) redirect("/resources");

  const { article, category } =
    await fetchArticleBySlugOnly(supabase, slug, true);

  if (!article || !category) notFound();

  // Only native articles can be edited here
  const contentType = (article as { content_type: string }).content_type;
  if (contentType === "google_doc") {
    // Redirect to Google Docs
    const docUrl = (article as { google_doc_url?: string }).google_doc_url;
    if (docUrl) redirect(docUrl);
    redirect(`/resources/article/${slug}`);
  }

  if (contentType !== "native") {
    redirect(`/resources/article/${slug}`);
  }

  return (
    <NativeArticleEditor
      article={article}
      category={category}
    />
  );
}
