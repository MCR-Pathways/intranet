import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProtectedNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Page Not Found</h2>
      <p className="text-muted-foreground text-center max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved. Check the URL and try again.
      </p>
      <Button asChild variant="outline">
        <Link href="/intranet">Back to Home</Link>
      </Button>
    </div>
  );
}
