"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  ClipboardList,
  Laptop,
  Settings,
  Heart,
  ChevronRight,
  PartyPopper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface InductionItem {
  id: string;
  category: string;
  icon: LucideIcon;
  title: string;
  description: string;
  type: "document" | "course" | "task";
  href: string;
}

const inductionItems: InductionItem[] = [
  {
    id: "welcome",
    category: "Getting Started",
    icon: ClipboardList,
    title: "Read Welcome Pack",
    description: "Review the MCR Pathways welcome documentation",
    type: "document",
    href: "/intranet/induction/welcome",
  },
  {
    id: "policies",
    category: "Getting Started",
    icon: FileText,
    title: "Read Key Policies",
    description: "Review and acknowledge key company policies",
    type: "document",
    href: "/intranet/induction/policies",
  },
  {
    id: "health_safety",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "Health & Safety Training",
    description: "Complete the mandatory health and safety course",
    type: "course",
    href: "/intranet/induction/health-safety",
  },
  {
    id: "gdpr",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "GDPR Training",
    description: "Complete the data protection awareness course",
    type: "course",
    href: "/intranet/induction/gdpr",
  },
  {
    id: "edi",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "EDI Training",
    description: "Complete the equality, diversity and inclusion course",
    type: "course",
    href: "/intranet/induction/edi",
  },
  {
    id: "cyber_security",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "Cyber Security Training",
    description: "Complete the cyber security awareness course",
    type: "course",
    href: "/intranet/induction/cyber-security",
  },
  {
    id: "it_setup",
    category: "IT Setup",
    icon: Laptop,
    title: "IT Account Setup",
    description: "Ensure your IT accounts are properly configured",
    type: "task",
    href: "/intranet/induction/it-setup",
  },
  {
    id: "email_signature",
    category: "IT Setup",
    icon: Settings,
    title: "Set Up Email Signature",
    description: "Configure your MCR Pathways email signature",
    type: "task",
    href: "/intranet/induction/email-signature",
  },
  {
    id: "meet_team",
    category: "Team Integration",
    icon: Heart,
    title: "Meet Your Team",
    description: "Schedule introductions with your team members",
    type: "task",
    href: "/intranet/induction/meet-team",
  },
];

// Group items by category
function groupByCategory(items: InductionItem[]) {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, InductionItem[]>
  );
}

interface InductionChecklistProps {
  displayName: string;
  completedItemIds: string[];
  userId: string;
}

export function InductionChecklist({
  displayName,
  completedItemIds,
  userId,
}: InductionChecklistProps) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);

  const totalItems = inductionItems.length;
  const completedCount = completedItemIds.length;
  const progressPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  const allComplete = completedCount === totalItems;

  const groupedItems = groupByCategory(inductionItems);

  const handleCompleteInduction = async () => {
    setIsCompleting(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .update({
          induction_completed_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", userId);

      if (error) {
        console.error("Error completing induction:", error);
        return;
      }

      // Full page reload to clear middleware induction check
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Error completing induction:", err);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to MCR Pathways, {displayName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete the items below to finish your induction
        </p>
      </div>

      {/* Progress card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Induction Progress</CardTitle>
            <Badge
              variant={progressPercentage === 100 ? "success" : "secondary"}
            >
              {completedCount} of {totalItems} complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2">
            {progressPercentage === 100
              ? "Congratulations! You've completed all induction items."
              : `${totalItems - completedCount} items remaining`}
          </p>
        </CardContent>
      </Card>

      {/* Complete Induction button when all items are done */}
      {allComplete && (
        <Card className="border-status-active/30 bg-status-active/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-status-active" />
              <CardTitle className="text-lg">
                All items completed!
              </CardTitle>
            </div>
            <CardDescription>
              You&apos;ve completed all induction items. Click below to finalise
              your induction and unlock full access to the intranet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg">Complete Induction</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Complete Your Induction</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will finalise your induction and give you full access to
                    the MCR Pathways intranet. Are you ready?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose asChild>
                    <Button variant="outline">Not yet</Button>
                  </AlertDialogClose>
                  <Button
                    onClick={handleCompleteInduction}
                    disabled={isCompleting}
                  >
                    {isCompleting
                      ? "Completing..."
                      : "Yes, complete my induction"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Checklist by category */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
            <CardDescription>
              {items.filter((item) => completedItemIds.includes(item.id)).length}{" "}
              of {items.length} completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item) => {
                const isCompleted = completedItemIds.includes(item.id);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-start gap-4 p-4 rounded-lg border border-border transition-colors ${
                      isCompleted
                        ? "bg-muted/30 hover:bg-muted/50"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-status-active" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}
                        >
                          {item.title}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {item.type === "document"
                            ? "Document"
                            : item.type === "course"
                              ? "Course"
                              : "Task"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Help section */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Need help? Contact HR or your line manager if you have any questions
            about the induction process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
