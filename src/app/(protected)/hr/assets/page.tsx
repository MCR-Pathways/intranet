import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <p className="text-muted-foreground mt-1">
          View company assets assigned to you
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-1">
            Coming Soon
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Asset tracking is being developed. Check back soon to view
            company equipment and assets assigned to you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
