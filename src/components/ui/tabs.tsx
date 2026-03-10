"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva(
  "group inline-flex items-center justify-center text-muted-foreground",
  {
    variants: {
      variant: {
        default: "h-10 rounded-lg bg-muted p-1",
        line: "h-auto gap-1 rounded-none border-b bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>
>(({ className, variant = "default", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-variant={variant}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base styles (both variants)
      "inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      // Default variant (pill on muted bg)
      "group-data-[variant=default]:rounded-md group-data-[variant=default]:ring-offset-background group-data-[variant=default]:data-[state=active]:bg-background group-data-[variant=default]:data-[state=active]:text-foreground group-data-[variant=default]:data-[state=active]:shadow-sm",
      // Line variant (underline indicator)
      "group-data-[variant=line]:relative group-data-[variant=line]:rounded-none group-data-[variant=line]:bg-transparent group-data-[variant=line]:hover:text-foreground group-data-[variant=line]:data-[state=active]:text-foreground group-data-[variant=line]:data-[state=active]:shadow-none",
      // Line variant underline via after pseudo-element
      "group-data-[variant=line]:after:absolute group-data-[variant=line]:after:inset-x-0 group-data-[variant=line]:after:-bottom-px group-data-[variant=line]:after:h-0.5 group-data-[variant=line]:after:bg-foreground group-data-[variant=line]:after:opacity-0 group-data-[variant=line]:after:transition-opacity group-data-[variant=line]:data-[state=active]:after:opacity-100",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
