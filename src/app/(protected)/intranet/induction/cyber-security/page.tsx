import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

export default async function CyberSecurityPage() {
  const { isCompleted } = await getInductionItemStatus("cyber_security");

  return (
    <InductionItemPage
      itemId="cyber_security"
      title="Cyber Security Training"
      description="Complete the cyber security awareness course"
      type="course"
      category="Compliance Training"
      isCompleted={isCompleted}
    >
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">
            Cyber Security Awareness Training
          </h3>
          <p className="text-muted-foreground mb-4">
            Course content will be available here soon. This mandatory training
            covers cyber security best practices to keep you and the
            organisation safe.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>This course will cover:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Recognising phishing emails and scams</li>
              <li>Password security and multi-factor authentication</li>
              <li>Safe browsing and email practices</li>
              <li>Protecting sensitive information</li>
              <li>Social engineering awareness</li>
              <li>Reporting security incidents</li>
            </ul>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
