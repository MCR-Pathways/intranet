/**
 * localStorage utility for tracking recently viewed articles.
 * Used by the global search overlay to show recently visited articles
 * before the user types a query (Notion pattern).
 */

const RECENTLY_VIEWED_KEY = "mcr-recently-viewed";
const MAX_VIEWED = 5;

export interface RecentlyViewedItem {
  id: string;
  title: string;
  slug: string;
  viewedAt: number;
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw
      ? (JSON.parse(raw) as RecentlyViewedItem[]).slice(0, MAX_VIEWED)
      : [];
  } catch {
    return [];
  }
}

export function recordArticleView(article: {
  id: string;
  title: string;
  slug: string;
}): void {
  try {
    const items = getRecentlyViewed().filter((v) => v.id !== article.id);
    items.unshift({ ...article, viewedAt: Date.now() });
    localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify(items.slice(0, MAX_VIEWED))
    );
  } catch {
    // localStorage unavailable
  }
}
