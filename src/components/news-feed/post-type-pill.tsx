import { createElement } from "react";
import { BarChart3, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

const PILL_CONFIG = {
  poll: { label: "Poll", icon: BarChart3, className: "bg-mcr-light-blue-50 text-icon-fg-light-blue" },
  pinned: { label: "Pinned", icon: Pin, className: "bg-mcr-orange-50 text-icon-fg-orange" },
} as const;

export type PostPillType = keyof typeof PILL_CONFIG;

/**
 * The single signature pill for a post type, shown in the post header
 * (design-system §8.3). Poll = sky-blue, Pinned = orange — each on its own
 * brand-tint background. Multiple pills sit side by side when a post collides
 * (e.g. a pinned poll keeps both). This is the one place these pills live;
 * the poll and pinned treatments both render it.
 */
export function PostTypePill({ type }: { type: PostPillType }) {
  const { label, icon, className } = PILL_CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold leading-none",
        className,
      )}
    >
      {createElement(icon, { className: "h-3 w-3", "aria-hidden": true })}
      {label}
    </span>
  );
}
