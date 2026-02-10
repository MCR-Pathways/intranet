import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

export default async function EmailSignaturePage() {
  const { isCompleted } = await getInductionItemStatus("email_signature");

  return (
    <InductionItemPage
      itemId="email_signature"
      title="Set Up Email Signature"
      description="Configure your MCR Pathways email signature"
      type="task"
      category="IT Setup"
      isCompleted={isCompleted}
    >
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Email Signature Setup</h3>
          <p className="text-muted-foreground mb-4">
            Please set up your MCR Pathways email signature using the template
            below. Instructions for adding this to your Gmail account will be
            provided.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>Your email signature should include:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your full name</li>
              <li>Your job title</li>
              <li>MCR Pathways</li>
              <li>Your contact phone number</li>
              <li>The MCR Pathways logo</li>
              <li>Standard disclaimer text</li>
            </ul>
            <p className="mt-4 text-xs">
              Email signature template and instructions will be provided here
              soon.
            </p>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
