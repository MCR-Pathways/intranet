# Button system baseline (pre-sweep snapshot)

Captured 2026-04-22 before the button consistency pass. Survives even if the plan file in `~/.claude/plans/` is deleted. If the sweep needs to be rolled back, this file records the exact state to restore.

## Revert anchor

- Git tag: `pre-button-sweep`
- Commit: `031c6b73628b55b82ba9a1fb986979692827cac7`
- Subject: `docs: Periodic sync after PR #266 merge (#267)`

Restore via `git checkout pre-button-sweep`.

## Pre-sweep `src/components/ui/button.tsx`

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        secondary:   "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        success:     "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        action:      "bg-action text-action-foreground shadow-sm hover:bg-action/90",
        outline:     "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        link:        "text-link underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-md px-3 text-xs",
        lg:      "h-11 rounded-lg px-8",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

## Pre-sweep button-relevant `globals.css` tokens

### Light mode (`:root`)

- `--primary: var(--mcr-dark-blue)` (#213350)
- `--primary-foreground: #ffffff`
- `--secondary: #E8ECF0`
- `--secondary-foreground: var(--mcr-dark-blue)`
- `--destructive: #ef4444` (Tailwind red-500)
- `--destructive-foreground: #ffffff`
- `--success: #15803d`
- `--success-foreground: #ffffff`
- `--action: var(--mcr-pink)` (#DA417C, unused by any Button variant consumer at time of sweep)
- `--action-foreground: #ffffff`
- `--link: var(--mcr-teal)` (#2A6075)
- `--ring: var(--mcr-dark-blue)`
- `--radius: 0.75rem`

### Dark mode (`.dark`)

- `--primary: var(--mcr-dark-blue)` (same value as light — 1.41:1 contrast bug against dark card)
- `--destructive: #ef4444` (same value as light)
- `--ring: var(--mcr-light-blue)` (#5BC6E9)

### Global rules

- `*:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`
- `@media (prefers-reduced-motion: reduce)` block covered animation/transition durations only. Transform-based `active:scale-95` was not explicitly overridden.

## Pre-sweep root `CLAUDE.md` button rules

Key rules from the pre-sweep `CLAUDE.md` that this pass replaces or extends:

- Variants by intent (default=routine, success=Publish/Approve, destructive=Delete/Remove, outline=secondary, ghost=utility)
- Inline delete row triggers use `ghost`; destructive colour lives only on the AlertDialog confirm
- Outline buttons on `bg-background` pages need `className="bg-card"` to stay visible
- `active:scale-95` present on every button via base class
- No explicit guidance for icon button sizes, casing, `aria-label`, disabled tooltips, `aria-pressed`, dark-mode contrast, or focus-ring behaviour

## Why this file exists

The plan file at `~/.claude/plans/hey-claude-i-want-synthetic-lantern.md` records the full baseline and revert plan. This doc is a repo-committed copy so the baseline survives even if that plan file is deleted or the `~/.claude` directory is lost. If you need to revert the button sweep, this file plus the `pre-button-sweep` tag are sufficient to restore the pre-sweep state.
