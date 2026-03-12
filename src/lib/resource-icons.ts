/**
 * Curated icon set and colour palette for resource categories.
 *
 * Icons are a subset of Lucide chosen for knowledge-base / HR / office contexts.
 * Colours follow the Notion model: 8 preset swatches (no hex picker).
 *
 * The database stores icon name (string) and colour key (string | null).
 * Components resolve these via RESOURCE_ICON_MAP and ICON_COLOURS.
 */

import {
  FileText,
  Folder,
  BookOpen,
  Shield,
  Star,
  Wrench,
  Users,
  Heart,
  Clock,
  Calendar,
  Building2,
  Briefcase,
  GraduationCap,
  Scale,
  Megaphone,
  Lightbulb,
  HandHelping,
  CircleDollarSign,
  Laptop,
  Globe,
  Phone,
  Mail,
  Lock,
  Key,
  ClipboardList,
  ListChecks,
  FileCheck,
  FileClock,
  FolderOpen,
  BookMarked,
  Landmark,
  BadgeCheck,
  ShieldCheck,
  HeartHandshake,
  Rocket,
  Compass,
  Map,
  Flag,
  Target,
  Award,
  Zap,
  Coffee,
  Home,
  Car,
  Plane,
  TreePine,
  type LucideIcon,
} from "lucide-react";

// ─── Icon registry ──────────────────────────────────────────────────────────

export interface IconEntry {
  icon: LucideIcon;
  label: string;
  category: string;
}

/** Grouped icons for the picker grid. Order = display order. */
export const ICON_CATEGORIES = [
  "Documents",
  "Office",
  "People",
  "Policy",
  "Learning",
  "General",
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

export const RESOURCE_ICONS: IconEntry[] = [
  // Documents
  { icon: FileText, label: "Document", category: "Documents" },
  { icon: Folder, label: "Folder", category: "Documents" },
  { icon: FolderOpen, label: "Open Folder", category: "Documents" },
  { icon: BookOpen, label: "Book", category: "Documents" },
  { icon: BookMarked, label: "Bookmarked", category: "Documents" },
  { icon: ClipboardList, label: "Checklist", category: "Documents" },
  { icon: ListChecks, label: "Tasks", category: "Documents" },
  { icon: FileCheck, label: "Approved", category: "Documents" },
  { icon: FileClock, label: "Pending", category: "Documents" },

  // Office
  { icon: Building2, label: "Office", category: "Office" },
  { icon: Briefcase, label: "Briefcase", category: "Office" },
  { icon: Laptop, label: "Laptop", category: "Office" },
  { icon: Phone, label: "Phone", category: "Office" },
  { icon: Mail, label: "Email", category: "Office" },
  { icon: Calendar, label: "Calendar", category: "Office" },
  { icon: Clock, label: "Clock", category: "Office" },
  { icon: Coffee, label: "Break", category: "Office" },

  // People
  { icon: Users, label: "Team", category: "People" },
  { icon: Heart, label: "Wellbeing", category: "People" },
  { icon: HeartHandshake, label: "Support", category: "People" },
  { icon: HandHelping, label: "Help", category: "People" },
  { icon: Home, label: "Remote", category: "People" },

  // Policy
  { icon: Shield, label: "Shield", category: "Policy" },
  { icon: ShieldCheck, label: "Verified", category: "Policy" },
  { icon: Scale, label: "Legal", category: "Policy" },
  { icon: Lock, label: "Security", category: "Policy" },
  { icon: Key, label: "Access", category: "Policy" },
  { icon: BadgeCheck, label: "Compliance", category: "Policy" },
  { icon: Landmark, label: "Governance", category: "Policy" },

  // Learning
  { icon: GraduationCap, label: "Learning", category: "Learning" },
  { icon: Lightbulb, label: "Ideas", category: "Learning" },
  { icon: Rocket, label: "Launch", category: "Learning" },
  { icon: Compass, label: "Guide", category: "Learning" },
  { icon: Map, label: "Roadmap", category: "Learning" },
  { icon: Target, label: "Goals", category: "Learning" },

  // General
  { icon: Star, label: "Star", category: "General" },
  { icon: Wrench, label: "Tools", category: "General" },
  { icon: CircleDollarSign, label: "Finance", category: "General" },
  { icon: Globe, label: "Web", category: "General" },
  { icon: Megaphone, label: "Announce", category: "General" },
  { icon: Flag, label: "Flag", category: "General" },
  { icon: Award, label: "Award", category: "General" },
  { icon: Zap, label: "Quick", category: "General" },
  { icon: Car, label: "Travel", category: "General" },
  { icon: Plane, label: "Abroad", category: "General" },
  { icon: TreePine, label: "Leave", category: "General" },
];

/**
 * Flat map from icon name (as stored in DB) to Lucide component.
 * Used by category-card, featured-resources, etc.
 */
export const RESOURCE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  RESOURCE_ICONS.map((entry) => [entry.icon.displayName!, entry.icon])
);

// Legacy aliases — the DB stores component names like "BookOpen", "FileText"
// which match Lucide displayName. This map handles them.

/** Resolve a stored icon name to a Lucide component, with fallback. */
export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Folder;
  return RESOURCE_ICON_MAP[name] ?? Folder;
}

/** Get the display name (DB-storable key) of a Lucide icon component. */
export function getIconName(icon: LucideIcon): string {
  return icon.displayName ?? "Folder";
}

// ─── Colour palette ─────────────────────────────────────────────────────────

export interface IconColour {
  key: string;
  label: string;
  /** Tailwind classes for the icon container background */
  bg: string;
  /** Tailwind classes for the icon foreground colour */
  fg: string;
}

/** 8 preset colour swatches using MCR brand colours with WCAG-compliant foregrounds. */
export const ICON_COLOURS: IconColour[] = [
  { key: "default", label: "Default", bg: "bg-primary/10", fg: "text-primary" },
  { key: "grey", label: "Grey", bg: "bg-muted", fg: "text-muted-foreground" },
  { key: "teal", label: "Teal", bg: "bg-mcr-teal/15 dark:bg-mcr-teal/15", fg: "text-icon-fg-teal" },
  { key: "green", label: "Green", bg: "bg-mcr-green/15 dark:bg-mcr-green/15", fg: "text-icon-fg-green" },
  { key: "orange", label: "Orange", bg: "bg-mcr-orange/15 dark:bg-mcr-orange/15", fg: "text-icon-fg-orange" },
  { key: "wine", label: "Wine", bg: "bg-mcr-wine/15 dark:bg-mcr-wine/15", fg: "text-icon-fg-wine" },
  { key: "light-blue", label: "Light Blue", bg: "bg-mcr-light-blue/15 dark:bg-mcr-light-blue/15", fg: "text-icon-fg-light-blue" },
  { key: "pink", label: "Pink", bg: "bg-mcr-pink/15 dark:bg-mcr-pink/15", fg: "text-icon-fg-pink" },
];

/** Maps old Tailwind-based colour keys to new MCR brand keys. */
const LEGACY_COLOUR_KEY_MAP: Record<string, string> = {
  blue: "teal",
  red: "wine",
  purple: "light-blue",
};
// "green", "orange", "pink" keep the same keys

/** Resolve a stored colour key to classes, with fallback to default. */
export function resolveIconColour(key: string | null | undefined): IconColour {
  if (!key || key === "default") return ICON_COLOURS[0];
  const mapped = LEGACY_COLOUR_KEY_MAP[key] ?? key;
  return ICON_COLOURS.find((c) => c.key === mapped) ?? ICON_COLOURS[0];
}
