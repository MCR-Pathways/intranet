"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ONBOARDING_STATUS_CONFIG, formatHRDate } from "@/lib/hr";
import type { OnboardingChecklistWithProgress } from "@/types/hr";
import type { PersonOption } from "@/components/hr/person-combobox";
import { OnboardingProgressBar } from "@/components/hr/onboarding-progress-bar";
import { CreateOnboardingDialog } from "@/components/hr/create-onboarding-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Settings, Search, AlertCircle, ClipboardList } from "lucide-react";
import { getInitials } from "@/lib/utils";

// =============================================
// TYPES
// =============================================

interface OnboardingDashboardContentProps {
  checklists: OnboardingChecklistWithProgress[];
  templates: Array<{ id: string; name: string; description: string | null; item_count: number }>;
  employees: PersonOption[];
}

// =============================================
// COMPONENT
// =============================================

export function OnboardingDashboardContent({
  checklists,
  templates,
  employees,
}: OnboardingDashboardContentProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  // Split into active and completed/cancelled
  const activeChecklists = useMemo(
    () => checklists.filter((c) => c.status === "active"),
    [checklists],
  );

  const completedChecklists = useMemo(
    () => checklists.filter((c) => c.status !== "active"),
    [checklists],
  );

  // Filter by search
  const filteredActive = useMemo(() => {
    if (!searchQuery.trim()) return activeChecklists;
    const q = searchQuery.toLowerCase();
    return activeChecklists.filter(
      (c) =>
        c.employee_name.toLowerCase().includes(q) ||
        c.template_name?.toLowerCase().includes(q) ||
        c.employee_department?.toLowerCase().includes(q),
    );
  }, [activeChecklists, searchQuery]);

  const filteredCompleted = useMemo(() => {
    if (!searchQuery.trim()) return completedChecklists;
    const q = searchQuery.toLowerCase();
    return completedChecklists.filter(
      (c) =>
        c.employee_name.toLowerCase().includes(q) ||
        c.template_name?.toLowerCase().includes(q) ||
        c.employee_department?.toLowerCase().includes(q),
    );
  }, [completedChecklists, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, template, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/hr/onboarding/templates">
              <Settings className="h-4 w-4 mr-2" />
              Manage Templates
            </Link>
          </Button>
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Onboarding
          </Button>
        </div>
      </div>

      {/* Active onboardings */}
      {filteredActive.length === 0 && activeChecklists.length === 0 ? (
        <EmptyState
          title="No active onboardings"
          description="Start an onboarding checklist for a new employee."
          icon={ClipboardList}
        />
      ) : filteredActive.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No results matching &quot;{searchQuery}&quot;
        </p>
      ) : (
        <div className="space-y-2">
          {filteredActive.map((checklist) => (
            <OnboardingRow key={checklist.id} checklist={checklist} />
          ))}
        </div>
      )}

      {/* Show completed toggle */}
      {completedChecklists.length > 0 && (
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? "Hide" : "Show"} completed ({completedChecklists.length})
          </Button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {filteredCompleted.map((checklist) => (
                <OnboardingRow key={checklist.id} checklist={checklist} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <CreateOnboardingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        templates={templates}
        employees={employees}
      />
    </div>
  );
}

// =============================================
// ONBOARDING ROW
// =============================================

function OnboardingRow({ checklist }: { checklist: OnboardingChecklistWithProgress }) {
  const statusConfig = ONBOARDING_STATUS_CONFIG[checklist.status];
  const isActive = checklist.status === "active";

  return (
    <Link href={`/hr/onboarding/${checklist.id}`}>
      <Card className={cn(
        "flex items-center gap-4 px-4 py-3 transition-shadow hover:shadow-md cursor-pointer",
        !isActive && "opacity-70",
      )}>
        {/* Avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={checklist.employee_avatar ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(checklist.employee_name)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{checklist.employee_name}</span>
            {checklist.employee_job_title && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                · {checklist.employee_job_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {checklist.template_name && (
              <span className="text-xs text-muted-foreground truncate">
                {checklist.template_name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              · Start: {formatHRDate(checklist.start_date)}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="w-32 shrink-0 hidden md:block">
          <OnboardingProgressBar
            completed={checklist.completed_items}
            total={checklist.total_items}
          />
        </div>

        {/* Overdue indicator */}
        {isActive && checklist.overdue_items > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            <span className="text-xs text-red-600 font-medium">
              {checklist.overdue_items} overdue
            </span>
          </div>
        )}

        {/* Status badge */}
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 border-0",
            statusConfig?.colour,
            statusConfig?.bgColour,
          )}
        >
          {statusConfig?.label ?? checklist.status}
        </Badge>
      </Card>
    </Link>
  );
}
