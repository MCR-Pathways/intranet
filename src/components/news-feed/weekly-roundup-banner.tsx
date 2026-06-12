import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getISOWeekNumber, formatDateRange } from "@/lib/utils";

interface WeeklyRoundupBannerProps {
  roundup: {
    id: string;
    title: string;
    summary: string | null;
    week_start: string;
    week_end: string;
  };
}

// The two speech-mark shapes from MCR_LOGO-1.svg, rendered stroke-only as
// decorative line-art (ADR-014 / design-system §8.3). currentColor so the
// stroke follows a Tailwind text-* class. Per the spec it appears ONLY on
// this banner — don't reuse it elsewhere in the feed.
const LOGOMARK_PATHS = [
  "M37.6473 0C24.2175 0 23.4552 0.762475 23.4552 14.1956V19.5549C23.4552 32.988 24.2175 33.7505 37.6473 33.7505C38.216 33.7505 38.7608 33.7505 39.2856 33.7445L31.4991 44.7425C48.1995 44.7425 51.8374 41.1038 51.8374 24.3992V14.1956C51.8394 0.762475 51.0771 0 37.6473 0Z",
  "M9.81791 2.79641C0.526815 2.79641 0 3.32335 0 12.6168V19.6767C0 31.2335 2.51833 33.7505 14.0703 33.7505L8.68446 26.1417C9.04764 26.1437 9.42479 26.1457 9.81791 26.1457C19.109 26.1457 19.6358 25.6188 19.6358 16.3254V12.6168C19.6358 3.32335 19.109 2.79641 9.81791 2.79641Z",
];

export function WeeklyRoundupBanner({ roundup }: WeeklyRoundupBannerProps) {
  const week = getISOWeekNumber(roundup.week_start);
  const covered = formatDateRange(roundup.week_start, roundup.week_end);

  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[14px] bg-mcr-dark-blue px-5 py-4 shadow-[0_1px_3px_rgba(33,51,80,0.07)]">
      {/* Quotemark line-art — bleeds off the bottom edge, behind the content. */}
      <svg
        viewBox="0 0 52 45"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[58px] right-[150px] w-[150px] -rotate-[10deg] text-mcr-orange opacity-[0.45]"
      >
        {LOGOMARK_PATHS.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="rounded-[5px] bg-mcr-yellow px-2.5 py-[3px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-mcr-dark-blue">
            Week {week}
          </span>
          <span className="whitespace-nowrap text-[15.5px] font-bold text-white">
            Your Weekly Round Up
          </span>
        </div>
        {roundup.summary ? (
          <p className="mt-1 truncate text-[13px] text-white/70">
            <span className="font-semibold text-white/90">{covered}</span>
            {" · "}
            {roundup.summary}
          </p>
        ) : (
          <p className="mt-1 text-[13px] font-semibold text-white/90">{covered}</p>
        )}
      </div>

      {/* Bespoke yellow-on-navy banner CTA. A styled Link, not the Button
          component: there's no yellow Button variant, and overriding one would
          fight the variant system. Keeps the app's tap-scale + focus-ring. */}
      <Link
        href={`/intranet/weekly-roundup/${roundup.id}`}
        className="relative inline-flex shrink-0 items-center gap-1.5 rounded-[9px] bg-mcr-yellow px-4 py-2 text-[13.5px] font-bold text-mcr-dark-blue transition-colors hover:bg-mcr-yellow/90 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mcr-dark-blue"
      >
        Read the round up
        <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden="true" />
      </Link>
    </div>
  );
}
