import { Globe, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VisibilityBadgeProps {
  visibility: "all" | "internal";
  className?: string;
}

export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  return (
    <Badge variant="outline" className={className ?? "shrink-0 text-xs gap-1"}>
      {visibility === "all" ? (
        <Globe className="h-3 w-3" />
      ) : (
        <Lock className="h-3 w-3" />
      )}
      {visibility === "all" ? "All" : "Internal"}
    </Badge>
  );
}
