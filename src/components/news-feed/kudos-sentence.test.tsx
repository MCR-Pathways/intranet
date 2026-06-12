import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KudosSentence } from "./kudos-sentence";
import { KUDOS_CATEGORIES } from "@/lib/intranet";

describe("KudosSentence", () => {
  it("renders the flowing sentence, bolding sender/recipients/fragment bodies", () => {
    const { container } = render(
      <KudosSentence
        senderName="Marc"
        recipientNames={["Aimee", "Chris"]}
        categories={[KUDOS_CATEGORIES.EXTRA_MILE]}
      />,
    );
    expect(container.textContent).toBe(
      "Marc sent kudos to Aimee and Chris for going the extra mile",
    );
    // Sender, recipients, and the fragment body are <strong>; connectors aren't.
    expect(screen.getByText("Marc").tagName).toBe("STRONG");
    expect(screen.getByText("Aimee").tagName).toBe("STRONG");
    expect(screen.getByText("going the extra mile").tagName).toBe("STRONG");
  });

  it("renders two categories joined with 'and'", () => {
    const { container } = render(
      <KudosSentence
        senderName="Marc"
        recipientNames={["Aimee"]}
        categories={[KUDOS_CATEGORIES.EXTRA_MILE, KUDOS_CATEGORIES.TEAM_PLAYER]}
      />,
    );
    expect(container.textContent).toBe(
      "Marc sent kudos to Aimee for going the extra mile and being a team player",
    );
  });
});
