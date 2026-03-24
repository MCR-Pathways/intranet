import Link from "next/link";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewModeBannerProps {
  courseId: string;
}

export function PreviewModeBanner({ courseId }: PreviewModeBannerProps) {
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-medium">Preview mode</span> — you are viewing
          this course as a learner would see it.
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" asChild>
        <Link href={`/learning/admin/courses/${courseId}`}>
          <X className="h-3.5 w-3.5 mr-1" />
          Exit Preview
        </Link>
      </Button>
    </div>
  );
}
