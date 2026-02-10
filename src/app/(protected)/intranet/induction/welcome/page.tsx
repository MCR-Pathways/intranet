import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

export default async function WelcomePackPage() {
  const { isCompleted } = await getInductionItemStatus("welcome");

  return (
    <InductionItemPage
      itemId="welcome"
      title="Read Welcome Pack"
      description="Review the MCR Pathways welcome documentation"
      type="document"
      category="Getting Started"
      isCompleted={isCompleted}
    >
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Welcome Pack</h3>
          <p className="text-muted-foreground mb-4">
            Welcome pack content will be available here soon. This will include
            an introduction to MCR Pathways, our mission, values, and everything
            you need to know to get started.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>The welcome pack will cover:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>About MCR Pathways</li>
              <li>Our mission and values</li>
              <li>Organisation structure</li>
              <li>Key contacts</li>
              <li>Working hours and expectations</li>
              <li>Support available to you</li>
            </ul>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
