import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // `motion-safe:` prefix on the tap-scale means the class only applies when
  // the user has NOT enabled prefers-reduced-motion — so no CSS override
  // block is needed. Same pattern for hover-lift on filled primaries.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-all duration-200 motion-safe:active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold tracking-tight shadow hover:bg-primary/90 motion-safe:hover:-translate-y-px hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground font-medium shadow-sm hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground font-semibold tracking-tight shadow hover:bg-destructive/90 motion-safe:hover:-translate-y-px hover:shadow-md active:scale-100 active:ring-4 active:ring-destructive/20",
        success:
          "bg-success text-success-foreground font-semibold tracking-tight shadow hover:bg-success/90 motion-safe:hover:-translate-y-px hover:shadow-md",
        outline:
          "border border-input bg-background text-foreground font-medium shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost:
          "font-medium hover:bg-accent hover:text-accent-foreground",
        link:
          // `transition-all` on the base class covers text-decoration-thickness
          // and text-underline-offset. `active:scale-100` overrides the base
          // scale. Only the duration override remains.
          "text-link font-medium underline underline-offset-[3px] decoration-1 hover:decoration-2 hover:underline-offset-4 active:scale-100 duration-150",
      },
      size: {
        // Hero carries prominence via height, text-base, and gap. Shadow
        // is applied via compoundVariants below — only for filled-primary
        // variants — so a hero ghost/link (theoretical; not used in
        // practice) doesn't sprout a shadow that contradicts the variant.
        // Font-weight follows the variant: a hero outline (login page
        // Google Sign In) stays font-medium so the primary default hero
        // button (Magic Link) can claim the visual lead via font-semibold.
        hero: "h-12 px-6 text-base gap-3 [&_svg]:size-5",
        lg: "h-11 px-8 [&_svg]:size-5",
        default: "h-10 px-4 py-2 [&_svg]:size-4",
        sm: "h-9 px-3 text-xs [&_svg]:size-3.5",
        icon: "h-10 w-10 [&_svg]:size-5",
        "icon-sm": "h-8 w-8 [&_svg]:size-4",
        "icon-xs": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    compoundVariants: [
      // Hero prominence via shadow-lg only lands on filled primaries.
      // Outline/secondary/ghost/link at hero size keep their variant's
      // own shadow (or none). Keeps hero visually consistent with the
      // variant's design intent: Magic Link (default+hero) gets heavy
      // shadow-lg; Google Sign In (outline+hero) stays shadow-sm.
      {
        variant: ["default", "success", "destructive"],
        size: "hero",
        class: "shadow-lg",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
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
