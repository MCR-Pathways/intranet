/**
 * Left-spine accent for a post card (design-system §8.3 collision rules).
 *
 * One spine per card, and pin wins it: a pinned post takes the orange spine —
 * except kudos, which keeps its yellow top strip and takes no left spine. An
 * unpinned poll takes the sky-blue spine. So a pinned poll shows orange (not
 * sky-blue) alongside both header pills, never two spines. Everything else has
 * no spine.
 */
export function postSpineClass({
  isPinned,
  isKudos,
  isPoll,
}: {
  isPinned: boolean;
  isKudos: boolean;
  isPoll: boolean;
}): string | null {
  // Kudos never takes a left spine — it carries its yellow top strip instead.
  if (isKudos) return null;
  // Then pin wins the spine over poll.
  if (isPinned) return "border-l-4 border-l-mcr-orange";
  if (isPoll) return "border-l-4 border-l-mcr-light-blue";
  return null;
}
