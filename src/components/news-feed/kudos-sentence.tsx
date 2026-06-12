import { Fragment } from "react";
import { buildKudosSentenceParts, type KudosCategory } from "@/lib/intranet";

interface KudosSentenceProps {
  senderName: string;
  recipientNames: string[];
  categories: KudosCategory[];
  className?: string;
}

/**
 * The kudos headline as a flowing sentence — sender, recipients, and the
 * category fragments, with the sender/recipients/fragment bodies rendered
 * <strong>. One renderer shared by the feed card and the compose live preview
 * (both reading buildKudosSentenceParts), so the preview is exactly what the
 * feed shows.
 */
export function KudosSentence({
  senderName,
  recipientNames,
  categories,
  className,
}: KudosSentenceProps) {
  const parts = buildKudosSentenceParts(senderName, recipientNames, categories);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </span>
  );
}
