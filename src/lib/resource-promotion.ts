/**
 * §3 single-item folder promotion. A category that resolves to exactly one
 * visible article and no visible subfolders is redundant nesting, so callers
 * redirect straight to the article.
 *
 * Operates on the already visibility-filtered fetch results (the folder page
 * fetches with `canViewDrafts`), so it promotes for readers who see one
 * published article, while an editor who also sees drafts gets `length > 1`
 * and stays on the folder page to manage them.
 *
 * @returns the article slug to redirect to, or null when the folder should
 *   render normally.
 */
export function promotionTargetSlug(
  directArticles: { slug: string }[],
  subcategoryGroups: unknown[],
): string | null {
  if (directArticles.length === 1 && subcategoryGroups.length === 0) {
    return directArticles[0].slug;
  }
  return null;
}
