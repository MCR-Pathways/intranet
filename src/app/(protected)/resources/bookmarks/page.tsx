import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fetchBookmarkedArticles } from "../actions";
import { BookmarksContent } from "@/components/resources/bookmarks-content";

export default async function BookmarksPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const bookmarkedArticles = await fetchBookmarkedArticles(supabase, user.id);

  return <BookmarksContent articles={bookmarkedArticles} />;
}
