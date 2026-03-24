"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import type { TeamMember } from "@/components/hr/team-member-card";
import type {
  ComplianceEnrolment,
  RequiredCourse,
} from "@/components/hr/team-dashboard-content";

interface TeamComplianceSectionProps {
  reports: TeamMember[];
  requiredCourses: RequiredCourse[];
  enrolments: ComplianceEnrolment[];
}

type ComplianceStatus = "completed" | "in_progress" | "overdue" | "not_enrolled";

interface ComplianceRow {
  memberId: string;
  memberName: string;
  courseStatuses: Record<string, { status: ComplianceStatus; progress: number }>;
  isCompliant: boolean;
}

function getComplianceStatus(
  enrolment: ComplianceEnrolment | undefined
): { status: ComplianceStatus; progress: number } {
  if (!enrolment) {
    return { status: "not_enrolled", progress: 0 };
  }

  if (enrolment.status === "completed") {
    return { status: "completed", progress: 100 };
  }

  const now = new Date();
  if (enrolment.due_date && new Date(enrolment.due_date) < now) {
    return { status: "overdue", progress: enrolment.progress_percent };
  }

  return { status: "in_progress", progress: enrolment.progress_percent };
}

const STATUS_BADGE_CONFIG: Record<
  ComplianceStatus,
  { label: string; variant: "success" | "default" | "destructive" | "secondary" }
> = {
  completed: { label: "Completed", variant: "success" },
  in_progress: { label: "In Progress", variant: "default" },
  overdue: { label: "Overdue", variant: "destructive" },
  not_enrolled: { label: "Not Enrolled", variant: "secondary" },
};

export function TeamComplianceSection({
  reports,
  requiredCourses,
  enrolments,
}: TeamComplianceSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Build enrolment lookup: `${userId}-${courseId}` → enrolment
  const enrolmentMap = useMemo(() => {
    const map = new Map<string, ComplianceEnrolment>();
    for (const e of enrolments) {
      map.set(`${e.user_id}-${e.course_id}`, e);
    }
    return map;
  }, [enrolments]);

  // Build rows
  const rows = useMemo<ComplianceRow[]>(() => {
    return reports.map((member) => {
      const courseStatuses: Record<
        string,
        { status: ComplianceStatus; progress: number }
      > = {};
      let allCompleted = true;

      for (const course of requiredCourses) {
        const enrolment = enrolmentMap.get(`${member.id}-${course.id}`);
        const result = getComplianceStatus(enrolment);
        courseStatuses[course.id] = result;
        if (result.status !== "completed") {
          allCompleted = false;
        }
      }

      return {
        memberId: member.id,
        memberName: member.preferred_name ?? member.full_name,
        courseStatuses,
        isCompliant: allCompleted,
      };
    });
  }, [reports, requiredCourses, enrolmentMap]);

  // Summary
  const compliantCount = rows.filter((r) => r.isCompliant).length;
  const totalCount = rows.length;

  // Dynamic columns
  const columns = useMemo<ColumnDef<ComplianceRow>[]>(() => {
    const cols: ColumnDef<ComplianceRow>[] = [
      {
        accessorKey: "memberName",
        header: "Team Member",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.memberName}</span>
        ),
      },
    ];

    for (const course of requiredCourses) {
      cols.push({
        id: `course-${course.id}`,
        header: course.title,
        cell: ({ row }) => {
          const cs = row.original.courseStatuses[course.id];
          if (!cs) return null;
          const config = STATUS_BADGE_CONFIG[cs.status];
          return (
            <div className="flex items-center gap-1.5">
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
              {cs.status === "in_progress" && (
                <span className="text-xs text-muted-foreground">
                  {cs.progress}%
                </span>
              )}
            </div>
          );
        },
        enableSorting: false,
      });
    }

    return cols;
  }, [requiredCourses]);

  const summaryVariant =
    compliantCount === totalCount
      ? "success"
      : compliantCount >= totalCount / 2
        ? "warning"
        : "destructive";

  return (
    <div className="space-y-3">
      {/* Collapsible header */}
      <Button
        variant="ghost"
        className="flex items-center gap-2 px-0 hover:bg-transparent"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <BookOpen className="h-5 w-5" />
        <span className="text-lg font-semibold">Team Compliance</span>
        <Badge variant={summaryVariant} className="ml-1">
          {compliantCount} of {totalCount} compliant
        </Badge>
      </Button>

      {isOpen && (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="No compliance data available"
          initialSorting={[{ id: "memberName", desc: false }]}
        />
      )}
    </div>
  );
}
