"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export interface MentionUser {
  id: string;
  label: string;
  avatar_url: string | null;
  job_title: string | null;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection index when filtered items change — standard Tiptap Suggestion pattern.
    // This is intentional: items is the external system state from Tiptap's Suggestion plugin,
    // and we sync our selectedIndex to it.
    useEffect(() => {
      setSelectedIndex(0); // eslint-disable-line react-hooks/set-state-in-effect
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command({ id: item.id, label: item.label });
        }
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex(
            (prev) => (prev + items.length - 1) % items.length
          );
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border bg-popover p-2 shadow-md">
          <p className="text-xs text-muted-foreground px-1">No results</p>
        </div>
      );
    }

    return (
      <div className="max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
            onClick={() => selectItem(index)}
          >
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={item.avatar_url || undefined} alt={item.label} />
              <AvatarFallback className="bg-muted text-[10px]">
                {getInitials(item.label)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              {item.job_title && (
                <p className="truncate text-xs text-muted-foreground">
                  {item.job_title}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";
