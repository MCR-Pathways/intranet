import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

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
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Meet Your Team</h3>
          <p className="text-muted-foreground mb-4">
            Getting to know your team is an important part of your induction.
            Please arrange introductions with your team members and key
            colleagues.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>Suggested actions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Schedule a meeting with your line manager</li>
              <li>Introduce yourself to your immediate team</li>
              <li>Meet key people from other departments you&apos;ll work with</li>
              <li>Join your team&apos;s communication channels</li>
              <li>Attend the next team meeting</li>
            </ul>
            <p className="mt-4 text-xs">
              Speak to your line manager if you&apos;re unsure who to meet.
            </p>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
