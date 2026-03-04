"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrgChartPersonCard } from "@/components/hr/org-chart-person-card";
import { DEPARTMENT_CONFIG } from "@/lib/hr";
import type { Department } from "@/lib/hr";
import { Users, Search, Locate, Maximize2, Minimize2 } from "lucide-react";
import type { RawNodeDatum, TreeNodeDatum } from "react-d3-tree";

// Dynamically import Tree to avoid SSR issues with D3
const Tree = dynamic(() => import("react-d3-tree").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Loading org chart...
    </div>
  ),
});

// =============================================
// TYPES
// =============================================

export interface OrgPerson {
  id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  department: string | null;
  region: string | null;
  line_manager_id: string | null;
  is_line_manager: boolean;
  is_external: boolean;
  fte: number;
}

interface OrgChartContentProps {
  people: OrgPerson[];
  onLeaveIds: string[];
  currentUserId: string;
}

// =============================================
// TREE BUILDING
// =============================================

interface OrgNodeAttributes {
  personId: string;
  jobTitle: string;
  department: string;
  isExternal: boolean;
  isOnLeave: boolean;
  fte: number;
  avatarUrl: string;
  directReportCount: number;
}

function buildTree(
  people: OrgPerson[],
  onLeaveSet: Set<string>,
): RawNodeDatum | null {
  // Build children map
  const childrenMap = new Map<string | null, OrgPerson[]>();
  for (const person of people) {
    const parent = person.line_manager_id;
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(person);
  }

  // Find roots (no manager, or manager not in active set)
  const activeIds = new Set(people.map((p) => p.id));
  const roots = people.filter(
    (p) => !p.line_manager_id || !activeIds.has(p.line_manager_id)
  );

  if (roots.length === 0) return null;

  function toNode(person: OrgPerson): RawNodeDatum {
    const children = childrenMap.get(person.id) ?? [];
    return {
      name: person.full_name,
      attributes: {
        personId: person.id,
        jobTitle: person.job_title ?? "",
        department: person.department ?? "",
        isExternal: person.is_external,
        isOnLeave: onLeaveSet.has(person.id),
        fte: person.fte,
        avatarUrl: person.avatar_url ?? "",
        directReportCount: children.length,
      } as Record<string, string | number | boolean>,
      children: children.map(toNode),
    };
  }

  // If single root, use it directly; if multiple, create a virtual root
  if (roots.length === 1) {
    return toNode(roots[0]);
  }

  return {
    name: "MCR Pathways",
    attributes: {
      personId: "",
      jobTitle: "",
      department: "",
      isExternal: false,
      isOnLeave: false,
      fte: 1,
      avatarUrl: "",
      directReportCount: roots.length,
    } as Record<string, string | number | boolean>,
    children: roots.map(toNode),
  };
}

// =============================================
// COMPONENT
// =============================================

export function OrgChartContent({
  people,
  onLeaveIds,
  currentUserId,
}: OrgChartContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [expandAll, setExpandAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onLeaveSet = useMemo(() => new Set(onLeaveIds), [onLeaveIds]);

  // Filter people by department if selected
  const filteredPeople = useMemo(() => {
    if (departmentFilter === "all") return people;
    return people.filter((p) => p.department === departmentFilter);
  }, [people, departmentFilter]);

  const treeData = useMemo(
    () => buildTree(filteredPeople, onLeaveSet),
    [filteredPeople, onLeaveSet]
  );

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>();
    people.forEach((p) => {
      if (p.department) depts.add(p.department);
    });
    return Array.from(depts).sort();
  }, [people]);

  // Search: find the node that matches and highlight it
  const searchMatch = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return people.find(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.job_title && p.job_title.toLowerCase().includes(q))
    );
  }, [searchQuery, people]);

  // Find Me — locate current user
  const handleFindMe = useCallback(() => {
    const me = people.find((p) => p.id === currentUserId);
    if (me) {
      setSearchQuery(me.full_name);
    }
  }, [people, currentUserId]);

  const renderCustomNode = useCallback(
    ({ nodeDatum }: { nodeDatum: TreeNodeDatum }) => {
      const attrs = nodeDatum.attributes as unknown as OrgNodeAttributes;
      if (!attrs.personId) {
        // Virtual root node
        return (
          <foreignObject width={200} height={50} x={-100} y={-25}>
            <div className="flex h-full items-center justify-center rounded-lg border bg-card px-3 py-2 shadow-sm">
              <span className="text-sm font-semibold">{nodeDatum.name}</span>
            </div>
          </foreignObject>
        );
      }

      const isHighlighted = searchMatch?.id === attrs.personId;

      return (
        <OrgChartPersonCard
          name={nodeDatum.name}
          jobTitle={attrs.jobTitle}
          department={attrs.department as Department | ""}
          avatarUrl={attrs.avatarUrl}
          isExternal={attrs.isExternal}
          isOnLeave={attrs.isOnLeave}
          fte={attrs.fte}
          directReportCount={attrs.directReportCount}
          isHighlighted={isHighlighted}
        />
      );
    },
    [searchMatch]
  );

  if (!treeData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Org Chart"
          subtitle="View the organisation structure"
        />
        <EmptyState
          icon={Users}
          title="No organisation data"
          description="No active staff profiles found."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Org Chart"
        subtitle={`${people.length} active staff`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 pl-9 h-9"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_CONFIG[d as Department]?.label ?? d}
                </option>
              ))}
            </select>

            <Button variant="outline" size="sm" onClick={handleFindMe}>
              <Locate className="h-4 w-4 mr-1" />
              Find Me
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandAll((prev) => !prev)}
            >
              {expandAll ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-1" />
                  Expand All
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Search result indicator */}
      {searchMatch && (
        <p className="text-sm text-muted-foreground">
          Found: <span className="font-medium text-foreground">{searchMatch.full_name}</span>
          {searchMatch.job_title && ` — ${searchMatch.job_title}`}
        </p>
      )}

      <div
        ref={containerRef}
        role="img"
        aria-label={`Organisation chart showing ${people.length} staff members${departmentFilter !== "all" ? ` in ${DEPARTMENT_CONFIG[departmentFilter as Department]?.label ?? departmentFilter}` : ""}`}
        aria-roledescription="organisation chart"
        className="relative h-[calc(100vh-220px)] min-h-[400px] overflow-hidden rounded-lg border bg-background"
      >
        <Tree
          data={treeData}
          orientation="vertical"
          pathFunc="step"
          translate={{ x: 400, y: 60 }}
          nodeSize={{ x: 240, y: 120 }}
          separation={{ siblings: 1.2, nonSiblings: 1.5 }}
          renderCustomNodeElement={renderCustomNode}
          initialDepth={expandAll ? undefined : 2}
          key={`${departmentFilter}-${expandAll}`}
          zoomable
          draggable
          collapsible
          pathClassFunc={() => "stroke-border"}
        />
      </div>
    </div>
  );
}
