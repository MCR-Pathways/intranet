import { createElement } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";

interface ArticleBreadcrumbProps {
  category: {
    name: string;
    slug: string;
    icon: string | null;
    icon_colour: string | null;
  };
  parentCategory: { name: string; slug: string } | null;
  title: string;
}

const LINK_CLASSES = "hover:text-foreground hover:underline underline-offset-4";
const SEPARATOR = (
  <span className="text-muted-foreground/50 select-none">/</span>
);

export function ArticleBreadcrumb({
  category,
  parentCategory,
  title,
}: ArticleBreadcrumbProps) {
  const Icon = resolveIcon(category.icon);
  const colour = resolveIconColour(category.icon_colour);
  const categoryPath = parentCategory
    ? `${parentCategory.slug}/${category.slug}`
    : category.slug;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
      <Link href="/resources" className={LINK_CLASSES}>
        Resources
      </Link>
      {parentCategory && (
        <>
          {SEPARATOR}
          <Link
            href={`/resources/${parentCategory.slug}`}
            className={LINK_CLASSES}
          >
            {parentCategory.name}
          </Link>
        </>
      )}
      {SEPARATOR}
      <Link
        href={`/resources/${categoryPath}`}
        className={cn("inline-flex items-center gap-1.5", LINK_CLASSES)}
      >
        {createElement(Icon, {
          className: cn("h-3.5 w-3.5", colour.fg),
        })}
        {category.name}
      </Link>
      {SEPARATOR}
      <span className="text-foreground font-medium">{title}</span>
    </nav>
  );
}
