import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  GraduationCap,
  Shield,
  Lightbulb,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export default function LearningPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning</h1>
        <p className="text-muted-foreground mt-1">
          Develop your skills and complete required training
        </p>
      </div>

      {/* Compliance alert */}
      <Card className="border-secondary bg-secondary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-secondary" />
            <CardTitle className="text-lg">Compliance Training Due</CardTitle>
          </div>
          <CardDescription>
            You have 2 compliance courses that need to be completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/learning/courses/compliance">
              View Compliance Courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Course categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/learning/courses/compliance">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Compliance Courses
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="warning">2 due</Badge>
                <Badge variant="muted">4 completed</Badge>
              </div>
              <CardDescription>
                Required training for all staff
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/learning/courses/upskilling">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Upskilling
              </CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="muted">12 available</Badge>
              </div>
              <CardDescription>
                Optional courses to develop new skills
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/learning/tool-shed">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tool Shed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Searchable library of insights, best practices, and practical
                tools
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* My courses section */}
      <Card>
        <CardHeader>
          <CardTitle>My Courses</CardTitle>
          <CardDescription>Courses you&apos;re currently enrolled in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center max-w-sm">
              You haven&apos;t started any courses yet. Browse the course catalog to
              get started.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
