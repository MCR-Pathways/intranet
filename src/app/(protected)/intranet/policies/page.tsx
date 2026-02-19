import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
        <p className="text-muted-foreground mt-1">
          Company policies and procedures
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-1">
            Coming Soon
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Company policies and procedures will be available here shortly.
            Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
