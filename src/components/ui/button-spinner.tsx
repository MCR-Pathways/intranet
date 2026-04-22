import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type ButtonSpinnerSize = "xs" | "sm" | "default" | "lg";

interface ButtonSpinnerProps {
  /**
   * Matches the parent Button's `size` prop. Drives the spinner's icon
   * size via the same scale the Button uses for its SVGs:
   * - `xs` / `sm` → 14px (size-3.5)
   * - `default` → 16px (size-4)
   * - `lg` → 20px (size-5)
   *
   * Defaults to `default`.
   */
  size?: ButtonSpinnerSize;
  className?: string;
}

const SIZE_CLASSES: Record<ButtonSpinnerSize, string> = {
  xs: "size-3.5",
  sm: "size-3.5",
  default: "size-4",
  lg: "size-5",
};

/**
 * Loading spinner for use inside `<Button>` while a request is in flight.
 * Inherits colour via `currentColor` from the surrounding button's text.
 *
 * Usage:
 * ```tsx
 * <Button disabled={pending} aria-busy={pending}>
 *   {pending && <ButtonSpinner size="default" />}
 *   Submit
 * </Button>
 * ```
 *
 * Keep the original label visible (spinner + "Saving..." or similar) per
 * our loading-state rule.
 */
export function ButtonSpinner({
  size = "default",
  className,
}: ButtonSpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", SIZE_CLASSES[size], className)}
      aria-hidden="true"
    />
  );
}
