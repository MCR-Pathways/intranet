import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  ClipboardList,
  Laptop,
  Settings,
  Heart,
} from "lucide-react";

// Induction checklist items - would be fetched from database in production
const inductionItems = [
  {
    id: "welcome",
    category: "Getting Started",
    icon: ClipboardList,
    title: "Read Welcome Pack",
    description: "Review the MCR Pathways welcome documentation",
    type: "document",
  },
  {
    id: "policies",
    category: "Getting Started",
    icon: FileText,
    title: "Read Key Policies",
    description: "Review and acknowledge key company policies",
    type: "document",
  },
  {
    id: "health_safety",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "Health & Safety Training",
    description: "Complete the mandatory health and safety course",
    type: "course",
  },
  {
    id: "gdpr",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "GDPR Training",
    description: "Complete the data protection awareness course",
    type: "course",
  },
  {
    id: "edi",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "EDI Training",
    description: "Complete the equality, diversity and inclusion course",
    type: "course",
  },
  {
    id: "cyber_security",
    category: "Compliance Training",
    icon: GraduationCap,
    title: "Cyber Security Training",
    description: "Complete the cyber security awareness course",
    type: "course",
  },
  {
    id: "it_setup",
    category: "IT Setup",
    icon: Laptop,
    title: "IT Account Setup",
    description: "Ensure your IT accounts are properly configured",
    type: "task",
  },
  {
    id: "email_signature",
    category: "IT Setup",
    icon: Settings,
    title: "Set Up Email Signature",
    description: "Configure your MCR Pathways email signature",
    type: "task",
  },
  {
    id: "meet_team",
    category: "Team Integration",
    icon: Heart,
    title: "Meet Your Team",
    description: "Schedule introductions with your team members",
    type: "task",
  },
];

// Group items by category
function groupByCategory(items: typeof inductionItems) {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, typeof inductionItems>
  );
}

export default async function InductionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If induction is already completed, redirect to dashboard
  if (profile?.induction_completed_at) {
    redirect("/dashboard");
  }

  // In production, this would fetch actual progress from the database
  const completedItems: string[] = [];
  const totalItems = inductionItems.length;
  const completedCount = completedItems.length;
  const progressPercentage = Math.round((completedCount / totalItems) * 100);

  const groupedItems = groupByCategory(inductionItems);
  const displayName = profile?.preferred_name || profile?.full_name || "there";

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

      {/* Checklist by category */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
            <CardDescription>
              {items.filter((item) => completedItems.includes(item.id)).length}{" "}
              of {items.length} completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item) => {
                const isCompleted = completedItems.includes(item.id);
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
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
                    <div className="flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
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
