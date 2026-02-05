import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  BookOpen,
  FileText,
  Video,
  Link2,
  Download,
  Users,
  Shield,
  Heart,
  MessageSquare,
  Lightbulb,
  ExternalLink,
} from "lucide-react";

type ResourceCategory = "mentoring" | "safeguarding" | "wellbeing" | "communication" | "best_practices";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type: "document" | "video" | "link" | "template";
  url?: string;
  downloadUrl?: string;
  tags: string[];
}

const categoryConfig: Record<ResourceCategory, { label: string; icon: typeof BookOpen; color: string; bgColor: string }> = {
  mentoring: { label: "Mentoring", icon: Users, color: "text-blue-600", bgColor: "bg-blue-50" },
  safeguarding: { label: "Safeguarding", icon: Shield, color: "text-red-600", bgColor: "bg-red-50" },
  wellbeing: { label: "Wellbeing", icon: Heart, color: "text-pink-600", bgColor: "bg-pink-50" },
  communication: { label: "Communication", icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-50" },
  best_practices: { label: "Best Practices", icon: Lightbulb, color: "text-amber-600", bgColor: "bg-amber-50" },
};

const typeConfig = {
  document: { icon: FileText, label: "Document" },
  video: { icon: Video, label: "Video" },
  link: { icon: Link2, label: "External Link" },
  template: { icon: Download, label: "Template" },
};

const resources: Resource[] = [
  {
    id: "1",
    title: "Effective Mentoring Conversations Guide",
    description: "A comprehensive guide to structuring meaningful conversations with your mentee, including question frameworks and active listening techniques.",
    category: "mentoring",
    type: "document",
    downloadUrl: "#",
    tags: ["mentoring", "conversations", "guide"],
  },
  {
    id: "2",
    title: "Recognising Signs of Concern",
    description: "Quick reference guide for identifying potential safeguarding concerns and the appropriate steps to take.",
    category: "safeguarding",
    type: "document",
    downloadUrl: "#",
    tags: ["safeguarding", "child protection", "reference"],
  },
  {
    id: "3",
    title: "Self-Care for Coordinators",
    description: "Resources and strategies for maintaining your own wellbeing while supporting young people.",
    category: "wellbeing",
    type: "document",
    downloadUrl: "#",
    tags: ["wellbeing", "self-care", "burnout prevention"],
  },
  {
    id: "4",
    title: "Working with Schools: Best Practices",
    description: "Tips and strategies for building effective relationships with school staff and navigating school environments.",
    category: "communication",
    type: "document",
    downloadUrl: "#",
    tags: ["schools", "relationships", "communication"],
  },
  {
    id: "5",
    title: "Goal Setting with Young People",
    description: "Interactive workshop video demonstrating SMART goal setting techniques with mentees.",
    category: "mentoring",
    type: "video",
    url: "#",
    tags: ["goals", "SMART", "video", "workshop"],
  },
  {
    id: "6",
    title: "Mentor Matching Criteria Template",
    description: "Standardised template for documenting mentor-mentee matching considerations.",
    category: "best_practices",
    type: "template",
    downloadUrl: "#",
    tags: ["template", "matching", "mentors"],
  },
  {
    id: "7",
    title: "Trauma-Informed Approaches",
    description: "Understanding the impact of trauma on young people and how to respond with sensitivity.",
    category: "wellbeing",
    type: "document",
    downloadUrl: "#",
    tags: ["trauma", "ACEs", "sensitive practice"],
  },
  {
    id: "8",
    title: "MCR Pathways Safeguarding Policy",
    description: "Full safeguarding policy document with procedures and contact information.",
    category: "safeguarding",
    type: "document",
    downloadUrl: "#",
    tags: ["policy", "safeguarding", "procedures"],
  },
  {
    id: "9",
    title: "Monthly Check-In Template",
    description: "Template for structured monthly check-ins with mentees, including conversation prompts.",
    category: "mentoring",
    type: "template",
    downloadUrl: "#",
    tags: ["template", "check-in", "mentoring"],
  },
  {
    id: "10",
    title: "Engaging Reluctant Mentees",
    description: "Strategies for building rapport with young people who may be disengaged or reluctant to participate.",
    category: "communication",
    type: "document",
    downloadUrl: "#",
    tags: ["engagement", "rapport", "communication"],
  },
  {
    id: "11",
    title: "Session Planning Worksheet",
    description: "Planning template for structuring effective mentoring sessions with clear objectives.",
    category: "best_practices",
    type: "template",
    downloadUrl: "#",
    tags: ["planning", "template", "sessions"],
  },
  {
    id: "12",
    title: "GIRFEC Framework Overview",
    description: "Understanding the Getting It Right For Every Child framework and its application.",
    category: "best_practices",
    type: "link",
    url: "https://www.gov.scot/policies/girfec/",
    tags: ["GIRFEC", "Scotland", "framework"],
  },
];

function ResourceCard({ resource }: { resource: Resource }) {
  const category = categoryConfig[resource.category];
  const type = typeConfig[resource.type];
  const CategoryIcon = category.icon;
  const TypeIcon = type.icon;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className={`p-2 rounded-lg ${category.bgColor}`}>
            <CategoryIcon className={`h-5 w-5 ${category.color}`} />
          </div>
          <Badge variant="outline" className="shrink-0">
            <TypeIcon className="h-3 w-3 mr-1" />
            {type.label}
          </Badge>
        </div>
        <CardTitle className="text-base mt-3">{resource.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {resource.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
        <div className="flex flex-wrap gap-1 mb-4">
          {resource.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="muted" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          {resource.url && (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </a>
            </Button>
          )}
          {resource.downloadUrl && (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={resource.downloadUrl} download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ToolShedPage() {
  // Group resources by category
  const resourcesByCategory = Object.entries(categoryConfig).map(([key, config]) => ({
    category: key as ResourceCategory,
    config,
    resources: resources.filter((r) => r.category === key),
  })).filter((group) => group.resources.length > 0);

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/learning">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Learning
        </Link>
      </Button>

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tool Shed</h1>
          <p className="text-muted-foreground mt-1">
            Searchable library of insights, best practices, and practical tools
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources by title, description, or tags..."
              className="pl-10"
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Search functionality coming soon. Browse by category below.
          </p>
        </CardContent>
      </Card>

      {/* Category quick links */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <a key={key} href={`#${key}`}>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-2 px-3">
                <Icon className={`h-4 w-4 mr-2 ${config.color}`} />
                {config.label}
              </Badge>
            </a>
          );
        })}
      </div>

      {/* Resources by category */}
      {resourcesByCategory.map(({ category, config, resources }) => (
        <section key={category} id={category} className="scroll-mt-6">
          <div className="flex items-center gap-2 mb-4">
            <config.icon className={`h-5 w-5 ${config.color}`} />
            <h2 className="text-xl font-semibold">{config.label}</h2>
            <Badge variant="muted">{resources.length} resources</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </section>
      ))}

      {/* Empty state */}
      {resourcesByCategory.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No resources available yet. Check back soon!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Request resource section */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Can&apos;t find what you&apos;re looking for?</CardTitle>
          <CardDescription>
            If you need a specific resource or have a suggestion for the Tool Shed, let us know.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="mailto:support@mcrpathways.org?subject=Tool Shed Resource Request">
              <MessageSquare className="h-4 w-4 mr-2" />
              Request a Resource
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
