import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold tracking-tight shadow hover:bg-primary/90 hover:-translate-y-px hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground font-medium shadow-sm hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground font-semibold tracking-tight shadow hover:bg-destructive/90 hover:-translate-y-px hover:shadow-md active:scale-100 active:ring-4 active:ring-destructive/20",
        success:
          "bg-success text-success-foreground font-semibold tracking-tight shadow hover:bg-success/90 hover:-translate-y-px hover:shadow-md",
        outline:
          "border border-input bg-background text-foreground font-medium shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost:
          "font-medium hover:bg-accent hover:text-accent-foreground",
        link:
          "text-link font-medium underline underline-offset-[3px] decoration-1 hover:decoration-2 hover:underline-offset-4 active:scale-100 transition-[text-decoration-thickness,text-underline-offset,transform] duration-150",
      },
      size: {
        hero: "h-12 px-6 text-base gap-3 shadow-lg font-semibold tracking-tight [&_svg]:size-5",
        lg: "h-11 px-8 [&_svg]:size-5",
        default: "h-10 px-4 py-2 [&_svg]:size-4",
        sm: "h-9 px-3 text-xs [&_svg]:size-3.5",
        icon: "h-10 w-10 [&_svg]:size-5",
        "icon-sm": "h-8 w-8 [&_svg]:size-4",
        "icon-xs": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
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
