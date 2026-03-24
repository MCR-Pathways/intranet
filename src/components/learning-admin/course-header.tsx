"use client";

import { useState, useRef, useTransition } from "react";
import { updateCourse } from "@/app/(protected)/learning/admin/courses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings } from "lucide-react";
import { toast } from "sonner";

interface CourseHeaderProps {
  courseId: string;
  initialTitle: string;
  onSettingsClick: () => void;
}

export function CourseHeader({
  courseId,
  initialTitle,
  onSettingsClick,
}: CourseHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialTitle);

  const handleBlur = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      // Don't allow empty title — revert
      setTitle(lastSaved.current);
      return;
    }
    if (trimmed === lastSaved.current) return;

    startTransition(async () => {
      const result = await updateCourse(courseId, { title: trimmed });
      if (result.success) {
        lastSaved.current = trimmed;
      } else {
        toast.error("Failed to save title");
        setTitle(lastSaved.current);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setTitle(lastSaved.current);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="text-2xl font-bold border-transparent bg-transparent px-0 h-auto focus-visible:border-input focus-visible:bg-card focus-visible:px-3 transition-all"
        aria-label="Course title"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={onSettingsClick}
        className="shrink-0"
        aria-label="Course settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {isPending && (
        <span className="text-xs text-muted-foreground animate-pulse">
          Saving...
        </span>
      )}
    </div>
  );
}
