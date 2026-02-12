import type { ReactionType } from "@/types/database.types";

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like", emoji: "\uD83D\uDC4D", label: "Like" },
  { type: "love", emoji: "\u2764\uFE0F", label: "Love" },
  { type: "celebrate", emoji: "\uD83C\uDF89", label: "Celebrate" },
  { type: "insightful", emoji: "\uD83D\uDCA1", label: "Insightful" },
  { type: "curious", emoji: "\uD83E\uDD14", label: "Curious" },
];

export const REACTION_COLORS: Record<ReactionType, string> = {
  like: "text-blue-500",
  love: "text-red-500",
  celebrate: "text-yellow-500",
  insightful: "text-yellow-500",
  curious: "text-yellow-500",
};
