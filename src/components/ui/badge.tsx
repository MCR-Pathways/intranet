import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Tonal badges carry a subtle -200 border so the pill outline reads
        // even where the pale -50 fill matches the surface (zebra stripes,
        // ivory canvas) — see docs/colour-rework-audit.md F2.
        default:
          "border-blue-200 bg-blue-50 text-blue-700",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        destructive:
          "border-red-200 bg-red-50 text-red-700",
        outline: "text-foreground",
        success:
          "border-green-200 bg-green-50 text-green-700",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700",
        muted:
          "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
