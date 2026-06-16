import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";

import { resolveIconColour, type IconColourKey } from "@/lib/resource-icons";
import { cn } from "@/lib/utils";

interface InductionPlaceholderProps {
  /** Lucide icon for the step (e.g. BookOpen for the welcome pack). */
  icon: LucideIcon;
  /** ICON_COLOURS key for the accent swatch (teal/green/orange/wine/pink/light-blue/default). */
  accent?: IconColourKey;
  heading: string;
  /** Intro paragraph — what this step is about. */
  intro: string;
  /** Lead-in for the preview list, e.g. "This course will cover:". */
  listLabel: string;
  /** The "what this will cover" bullets. */
  items: string[];
  /** Optional trailing note (may carry inline emphasis, e.g. a contact email). */
  note?: React.ReactNode;
}

/**
 * Branded "coming soon" empty state for induction steps whose content isn't
 * written yet. Replaces the nine near-identical `border-dashed` placeholder
 * boxes (ADR-014 audit P3-E) — the dashes read as unfinished scaffolding, more
 * so on the warm ivory canvas. The MCR icon swatch + a Coming-soon pill carry
 * the shape instead; the surrounding white content card does the separating.
 */
export function InductionPlaceholder({
  icon: Icon,
  accent = "default",
  heading,
  intro,
  listLabel,
  items,
  note,
}: InductionPlaceholderProps) {
  const colour = resolveIconColour(accent);

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl",
          colour.bg
        )}
      >
        <Icon className={cn("h-7 w-7", colour.fg)} />
      </div>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <Clock className="h-3 w-3" />
        Coming soon
      </span>

      <h3 className="mt-3 text-lg font-semibold">{heading}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{intro}</p>

      <div className="mt-5 w-full max-w-md rounded-xl bg-muted/40 p-4 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {listLabel}
        </p>
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-foreground/80"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              {item}
            </li>
          ))}
        </ul>
        {note && <div className="mt-3 text-xs text-muted-foreground">{note}</div>}
      </div>
    </div>
  );
}
