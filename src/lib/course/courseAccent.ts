import type { CourseAccent } from '@/types/chat-content';

/**
 * Ready-made Tailwind class strings for a brand accent. Returning full literal
 * class strings (rather than composing them dynamically) is deliberate: Tailwind
 * only keeps classes it can see as literals in source, so dynamic concatenation
 * like `bg-mcr-${name}-50` would be purged. Token families come from
 * tailwind.config.ts (`mcr.db/lb/or/yl/gn/tl/pk/wn`).
 */
export interface AccentClasses {
  /** solid brand colour */
  text: string;
  bg: string;
  border: string;
  /** tinted surface + deep tone for on-tint content */
  tintBg: string;
  deepText: string;
  deepBg: string;
}

const MAP: Record<CourseAccent, AccentClasses> = {
  'dark-blue': {
    text: 'text-mcr-darkblue',
    bg: 'bg-mcr-darkblue',
    border: 'border-mcr-darkblue',
    tintBg: 'bg-mcr-db-50',
    deepText: 'text-mcr-db-700',
    deepBg: 'bg-mcr-db-700',
  },
  teal: {
    text: 'text-mcr-teal',
    bg: 'bg-mcr-teal',
    border: 'border-mcr-teal',
    tintBg: 'bg-mcr-tl-50',
    deepText: 'text-mcr-tl-700',
    deepBg: 'bg-mcr-tl-700',
  },
  'light-blue': {
    text: 'text-mcr-lightblue',
    bg: 'bg-mcr-lightblue',
    border: 'border-mcr-lightblue',
    tintBg: 'bg-mcr-lb-50',
    deepText: 'text-mcr-lb-700',
    deepBg: 'bg-mcr-lb-700',
  },
  orange: {
    text: 'text-mcr-orange',
    bg: 'bg-mcr-orange',
    border: 'border-mcr-orange',
    tintBg: 'bg-mcr-or-50',
    deepText: 'text-mcr-or-700',
    deepBg: 'bg-mcr-or-700',
  },
  pink: {
    text: 'text-mcr-pink',
    bg: 'bg-mcr-pink',
    border: 'border-mcr-pink',
    tintBg: 'bg-mcr-pk-50',
    deepText: 'text-mcr-pk-700',
    deepBg: 'bg-mcr-pk-700',
  },
  wine: {
    text: 'text-mcr-wine',
    bg: 'bg-mcr-wine',
    border: 'border-mcr-wine',
    tintBg: 'bg-mcr-wn-50',
    deepText: 'text-mcr-wn-700',
    deepBg: 'bg-mcr-wn-700',
  },
  green: {
    text: 'text-mcr-green',
    bg: 'bg-mcr-green',
    border: 'border-mcr-green',
    tintBg: 'bg-mcr-gn-50',
    deepText: 'text-mcr-gn-700',
    deepBg: 'bg-mcr-gn-700',
  },
  yellow: {
    text: 'text-mcr-yellow',
    bg: 'bg-mcr-yellow',
    border: 'border-mcr-yellow',
    tintBg: 'bg-mcr-yl-50',
    deepText: 'text-mcr-yl-700',
    deepBg: 'bg-mcr-yl-700',
  },
};

/** Resolve a brand accent name to ready-made Tailwind class strings. */
export function accent(name: CourseAccent | undefined): AccentClasses {
  return (name && MAP[name]) || MAP['dark-blue'];
}
