"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";

interface EnrolmentData {
  id: string;
  status: string;
  progress_percent: number;
  completed_at: string | null;
  due_date: string | null;
}

interface EnrolmentStatsCardProps {
  enrolments: EnrolmentData[];
}

export function EnrolmentStatsCard({
  enrolments,
}: EnrolmentStatsCardProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const total = enrolments.length;
    const inProgress = enrolments.filter(
      (e) => e.status === "in_progress"
    ).length;
    const completed = enrolments.filter(
      (e) => e.status === "completed"
    ).length;
    const overdue = enrolments.filter(
      (e) =>
        e.status !== "completed" &&
        e.due_date &&
        new Date(e.due_date) < now
    ).length;

    return { total, inProgress, completed, overdue };
  }, [enrolments]);

  const statItems = [
    {
      label: "Total Enrolled",
      value: stats.total,
      icon: Users,
      color: "text-foreground",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: BookOpen,
      color: "text-blue-600",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "text-red-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrolment Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((item) => (
            <div key={item.label} className="text-center">
              <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
        {stats.total > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-medium">
                {Math.round((stats.completed / stats.total) * 100)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
