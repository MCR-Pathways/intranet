"use client";

import { useState } from "react";
import Link from "next/link";
import { ONBOARDING_STATUS_CONFIG, formatHRDate } from "@/lib/hr";
import type { OnboardingChecklistWithProgress } from "@/types/hr";
import type { PersonOption } from "@/components/hr/person-combobox";
import { OnboardingProgressBar } from "@/components/hr/onboarding-progress-bar";
import { CreateOnboardingDialog } from "@/components/hr/create-onboarding-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ClipboardList, ExternalLink, Plus } from "lucide-react";

// =============================================
// TYPES
// =============================================

interface ProfileOnboardingTabProps {
  profileId: string;
  active: OnboardingChecklistWithProgress | null;
  history: OnboardingChecklistWithProgress[];
  /** Available templates for the create dialog */
  templates: Array<{ id: string; name: string; description: string | null; item_count: number }>;
  /** All employees for the person picker (only used if creating from here) */
  employees: PersonOption[];
  /** Whether the current user is an HR admin */
  isHRAdmin: boolean;
}

// =============================================
// COMPONENT
// =============================================

export function ProfileOnboardingTab({
  profileId,
  active,
  history,
  templates,
  employees,
  isHRAdmin,
}: ProfileOnboardingTabProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Active checklist */}
      {active ? (
        <ActiveChecklistCard checklist={active} />
      ) : (
        <EmptyState
          title="No active onboarding"
          description={
            isHRAdmin
              ? "Start an onboarding checklist for this employee."
              : "No onboarding checklist has been created for this employee."
          }
          icon={ClipboardList}
          action={
            isHRAdmin ? (
              <Button
                type="button"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Start Onboarding
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Completed history */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Previous Onboardings
          </h3>
          <div className="space-y-2">
            {history.map((checklist) => {
              const statusConfig = ONBOARDING_STATUS_CONFIG[checklist.status];
              return (
                <Link
                  key={checklist.id}
                  href={`/hr/onboarding/${checklist.id}`}
                >
                  <Card className="px-4 py-3 transition-shadow hover:shadow-md cursor-pointer opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {checklist.template_name ?? "Onboarding"}
                          </span>
                          <Badge
                            variant={statusConfig?.badgeVariant ?? "muted"}
                            className="text-xs"
                          >
                            {statusConfig?.label ?? checklist.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Started {formatHRDate(checklist.start_date)}
                          {checklist.completed_at && ` · Completed ${formatHRDate(checklist.completed_at)}`}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {checklist.completed_items}/{checklist.total_items} items
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Create dialog */}
      {isHRAdmin && (
        <CreateOnboardingDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          templates={templates}
          employees={employees}
          prefilledEmployeeId={profileId}
        />
      )}
    </div>
  );
}

// =============================================
// ACTIVE CHECKLIST CARD
// =============================================

function ActiveChecklistCard({ checklist }: { checklist: OnboardingChecklistWithProgress }) {
  const statusConfig = ONBOARDING_STATUS_CONFIG[checklist.status];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold">
                {checklist.template_name ?? "Onboarding Checklist"}
              </h3>
              <Badge variant={statusConfig?.badgeVariant ?? "muted"}>
                {statusConfig?.label ?? checklist.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Started {formatHRDate(checklist.start_date)}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`/hr/onboarding/${checklist.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              View Full Checklist
            </Link>
          </Button>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <OnboardingProgressBar
            completed={checklist.completed_items}
            total={checklist.total_items}
          />
        </div>

        {/* Overdue indicator */}
        {checklist.overdue_items > 0 && (
          <div className="flex items-center gap-1.5 mt-3">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            <span className="text-xs text-red-600 font-medium">
              {checklist.overdue_items} item{checklist.overdue_items !== 1 ? "s" : ""} overdue
            </span>
          </div>
        )}

        {checklist.notes && (
          <p className="text-sm text-muted-foreground mt-3">{checklist.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
