import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { Users } from "lucide-react";

export default async function MeetTeamPage() {
  const { isCompleted } = await getInductionItemStatus("meet_team");

  return (
    <InductionItemPage
      itemId="meet_team"
      title="Meet Your Team"
      description="Schedule introductions with your team members"
      type="task"
      category="Team Integration"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={Users}
        accent="wine"
        heading="Meet Your Team"
        intro="Getting to know your team is an important part of your induction. Please arrange introductions with your team members and key colleagues."
        listLabel="Suggested actions:"
        items={[
          "Schedule a meeting with your line manager",
          "Introduce yourself to your immediate team",
          "Meet key people from other departments you'll work with",
          "Join your team's communication channels",
          "Attend the next team meeting",
        ]}
        note="Speak to your line manager if you're unsure who to meet."
      />
    </InductionItemPage>
  );
}
