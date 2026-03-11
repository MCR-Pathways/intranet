import { Fragment } from "react";
import Link from "next/link";

// =============================================
// BREADCRUMBS
// =============================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && (
            <span className="text-muted-foreground/50 select-none" aria-hidden>/</span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-foreground hover:underline underline-offset-4 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

// =============================================
// PAGE HEADER
// =============================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-1">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
