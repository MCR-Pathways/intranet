import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Download,
  Edit,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { DestructiveMenuItem } from "@/components/ui/destructive-menu-item";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Root TooltipProvider wraps the (protected) tree in layout.tsx — no local
// provider needed per src/lib/CLAUDE.md.

export const metadata = {
  title: "Button Gallery (dev)",
};

const VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "success",
  "outline",
  "ghost",
  "link",
] as const;

const SIZES = [
  "hero",
  "lg",
  "default",
  "sm",
  "icon",
  "icon-sm",
  "icon-xs",
] as const;

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </header>
  );
}

/**
 * Dev-only gallery rendering every Button variant × size × state, plus all
 * helper components. Used for manual visual review during sweep PRs.
 * Gated behind `NODE_ENV === "development"` — returns 404 in production.
 *
 * Visit: http://localhost:3000/dev/button-gallery
 */
export default function ButtonGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
        <header className="space-y-2 border-b pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Button gallery
          </h1>
          <p className="text-muted-foreground">
            Dev-only visual reference for every variant × size × state, plus
            helpers. See <code>docs/button-system.md</code> for the rule set.
          </p>
        </header>

        {/* ───────────────────────────────── Variant × size matrix */}
        <section className="space-y-4">
          <SectionHeader
            title="Variant × size matrix"
            description="Every non-icon variant rendered at every non-icon size. Icon sizes render below."
          />
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Variant</th>
                  {(["hero", "lg", "default", "sm"] as const).map((s) => (
                    <th key={s} className="px-4 py-3 font-medium">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VARIANTS.map((variant) => (
                  <tr key={variant} className="border-b last:border-0">
                    <td className="px-4 py-4 font-medium">{variant}</td>
                    {(["hero", "lg", "default", "sm"] as const).map((size) => (
                      <td key={size} className="px-4 py-4">
                        <Button variant={variant} size={size}>
                          {variant === "link" ? "Learn more" : "Save changes"}
                        </Button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ───────────────────────────────── Icon sizes */}
        <section className="space-y-4">
          <SectionHeader
            title="Icon-only sizes"
            description="icon (h-10 default), icon-sm (h-8 for row actions), icon-xs (h-7 for hover-reveal kebabs). SVG inside auto-sizes per size variant."
          />
          <div className="flex items-center gap-4 flex-wrap">
            {(["icon", "icon-sm", "icon-xs"] as const).map((size) => (
              <div key={size} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-16">
                  {size}
                </span>
                <Button variant="ghost" size={size} aria-label="Edit">
                  <Pencil />
                </Button>
                <Button variant="ghost" size={size} aria-label="Delete">
                  <Trash2 />
                </Button>
                <Button variant="outline" size={size} aria-label="Close">
                  <X />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* ───────────────────────────────── With icons + labels */}
        <section className="space-y-4">
          <SectionHeader
            title="Icons with labels"
            description="Icon + text buttons across common actions. SVG size scales with the Button size."
          />
          <div className="flex flex-wrap gap-3">
            <Button>
              <Plus /> Add key date
            </Button>
            <Button variant="success">
              <Mail /> Send magic link
            </Button>
            <Button variant="destructive">
              <Trash2 /> Delete
            </Button>
            <Button variant="outline">
              <Download /> Export
            </Button>
            <Button variant="secondary">
              <ArrowLeft /> Back
            </Button>
            <Button variant="ghost" size="sm">
              <ChevronDown /> Show more
            </Button>
          </div>
        </section>

        {/* ───────────────────────────────── States */}
        <section className="space-y-4">
          <SectionHeader
            title="States"
            description="Idle, hover, focus, active, disabled. Focus ring is the global 2px outline at var(--ring). Disabled uses TooltipButton with a reason."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Idle</p>
              <Button>Save changes</Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Disabled (bare)</p>
              <Button disabled>Save changes</Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Disabled + reason (TooltipButton)</p>
              <TooltipButton disabled reason="Fill in the required fields first">
                Save changes
              </TooltipButton>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Loading (verb-ing + spinner)</p>
              <Button disabled aria-busy="true">
                <ButtonSpinner size="default" />
                Saving...
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Loading (hero)</p>
              <Button size="hero" disabled aria-busy="true">
                <ButtonSpinner size="lg" />
                Signing in...
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Destructive (ring-flash on active)</p>
              <Button variant="destructive">
                <Trash2 /> Delete
              </Button>
            </div>
          </div>
        </section>

        {/* ───────────────────────────────── Dialog footer */}
        <section className="space-y-4">
          <SectionHeader
            title="AlertDialog footer pattern"
            description="AlertDialogAction/Cancel are raw buttons. Override colour via utility classes — don't use buttonVariants (would fight their native styling)."
          />
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Cancel (secondary) left, primary action (destructive / success /
              default) right. These are raw buttons mirroring the Radix
              primitives so the same colour classes apply at runtime.
            </p>
            <div className="flex justify-end gap-2">
              <button className="mt-2 inline-flex h-10 items-center justify-center rounded-md border border-input bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground ring-offset-background transition-colors hover:bg-secondary/90 sm:mt-0">
                Cancel
              </button>
              <button className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground ring-offset-background transition-colors hover:bg-destructive/90">
                Delete article
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button className="mt-2 inline-flex h-10 items-center justify-center rounded-md border border-input bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground ring-offset-background transition-colors hover:bg-secondary/90 sm:mt-0">
                Cancel
              </button>
              <button className="inline-flex h-10 items-center justify-center rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground ring-offset-background transition-colors hover:bg-success/90">
                Publish
              </button>
            </div>
          </div>
        </section>

        {/* ───────────────────────────────── Kebab + destructive menu */}
        <section className="space-y-4">
          <SectionHeader
            title="Kebab + DestructiveMenuItem"
            description="Row kebab trigger uses Button variant=ghost size=icon-sm. Destructive menu item uses the helper with full class string."
          />
          <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-3">
            <p className="text-sm">Row: Annual leave policy</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Actions for Annual leave policy"
                  title="Actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DestructiveMenuItem>
                  <Trash2 /> Delete
                </DestructiveMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        {/* ───────────────────────────────── Link variant */}
        <section className="space-y-4">
          <SectionHeader
            title="Link variant"
            description="Always underlined (WCAG requirement for this teal). Thickens and lifts on hover."
          />
          <div className="flex flex-wrap items-center gap-6 bg-card p-6 rounded-xl border">
            <Button variant="link">Learn more</Button>
            <Button variant="link">View details</Button>
            <Button variant="link" asChild>
              <Link href="/resources">Browse resources</Link>
            </Button>
          </div>
        </section>

        {/* ───────────────────────────────── Size prop via matrix */}
        <section className="space-y-4">
          <SectionHeader
            title="All sizes"
            description={`${SIZES.length} sizes supported. Primary CTAs must be default, lg, or hero. sm is toolbar/filter-only.`}
          />
          <div className="flex items-center flex-wrap gap-3">
            {SIZES.filter((s) => !s.startsWith("icon")).map((size) => (
              <Button key={size} size={size}>
                Size: {size}
              </Button>
            ))}
          </div>
        </section>

        {/* ───────────────────────────────── Tap emulation */}
        <section className="space-y-4">
          <SectionHeader
            title="Tap / touch targets"
            description="Click each and watch the active state. Enable reduced motion in your OS — active:scale-95 should not fire."
          />
          <div className="flex gap-3 flex-wrap">
            <Button>Tap me</Button>
            <Button variant="destructive">Tap me (ring-flash)</Button>
            <Button variant="ghost">Tap me (ghost)</Button>
            <Button variant="outline" size="icon-sm" aria-label="Search">
              <Search />
            </Button>
            <Button variant="outline">
              <Upload /> Upload
            </Button>
          </div>
        </section>
      </main>
  );
}
