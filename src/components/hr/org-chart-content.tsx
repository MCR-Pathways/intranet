"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { select } from "d3-selection";
import { zoomIdentity } from "d3-zoom";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrgChartPersonCard } from "@/components/hr/org-chart-person-card";
import { DEPARTMENT_CONFIG } from "@/lib/hr";
import type { Department } from "@/lib/hr";
import {
  Users,
  Search,
  Locate,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Maximize,
  X,
} from "lucide-react";
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
// ZOOM HELPERS
// =============================================

function applyZoomTransform(
  containerEl: HTMLDivElement,
  scaleBy: number,
) {
  const svg = containerEl.querySelector("svg");
  if (!svg) return;

  try {
    // Access D3 zoom's internal state via __zoom on the SVG element
    const svgSelection = select(svg);
    const currentTransform =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (svg as any).__zoom ?? zoomIdentity;

    const newScale = currentTransform.k * scaleBy;
    // Clamp between 0.1 and 3
    if (newScale < 0.1 || newScale > 3) return;

    // Create new transform centred on the SVG midpoint
    const midX = svg.clientWidth / 2;
    const midY = svg.clientHeight / 2;

    const newTransform = zoomIdentity
      .translate(midX, midY)
      .scale(newScale)
      .translate(
        -midX + (currentTransform.x - midX * (1 - currentTransform.k)) / currentTransform.k,
        -midY + (currentTransform.y - midY * (1 - currentTransform.k)) / currentTransform.k,
      );

    // Apply via D3 zoom
    svgSelection.property("__zoom", newTransform);
    svgSelection
      .select("g")
      .attr(
        "transform",
        `translate(${newTransform.x},${newTransform.y}) scale(${newTransform.k})`,
      );
  } catch {
    // Silently fail if D3 zoom internals aren't accessible
  }
}

function fitToScreen(containerEl: HTMLDivElement) {
  const svg = containerEl.querySelector("svg");
  if (!svg) return;

  try {
    const svgSelection = select(svg);
    const g = svg.querySelector("g");
    if (!g) return;

    // Get the bounding box of the tree content
    const bbox = g.getBBox();
    const svgWidth = svg.clientWidth;
    const svgHeight = svg.clientHeight;

    const padding = 40;
    const scaleX = (svgWidth - padding * 2) / bbox.width;
    const scaleY = (svgHeight - padding * 2) / bbox.height;
    const scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x

    const translateX = svgWidth / 2 - (bbox.x + bbox.width / 2) * scale;
    const translateY = svgHeight / 2 - (bbox.y + bbox.height / 2) * scale;

    const newTransform = zoomIdentity.translate(translateX, translateY).scale(scale);

    svgSelection.property("__zoom", newTransform);
    svgSelection
      .select("g")
      .attr(
        "transform",
        `translate(${newTransform.x},${newTransform.y}) scale(${newTransform.k})`,
      );
  } catch {
    // Silently fail
  }
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
  const [expandAll, setExpandAll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 60 });

  const onLeaveSet = useMemo(() => new Set(onLeaveIds), [onLeaveIds]);

  // Dynamically centre the tree based on container width
  useEffect(() => {
    if (containerRef.current) {
      setTranslate({ x: containerRef.current.clientWidth / 2, y: 60 });
    }
  }, []);

  // Filter people by department if selected
  const filteredPeople = useMemo(() => {
    if (departmentFilter === "all") return people;
    return people.filter((p) => p.department === departmentFilter);
  }, [people, departmentFilter]);

  const treeData = useMemo(
    () => buildTree(filteredPeople, onLeaveSet),
    [filteredPeople, onLeaveSet]
  );

  // Get unique departments for filter and legend
  const activeDepartments = useMemo(() => {
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

  // Auto-expand tree when search finds a match
  const hasSearchInput = searchQuery.trim().length > 0;

  // Find Me — locate current user
  const handleFindMe = useCallback(() => {
    const me = people.find((p) => p.id === currentUserId);
    if (me) {
      setSearchQuery(me.full_name);
      setExpandAll(true);
    }
  }, [people, currentUserId]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setExpandAll(false);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (containerRef.current) applyZoomTransform(containerRef.current, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (containerRef.current) applyZoomTransform(containerRef.current, 0.7);
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (containerRef.current) fitToScreen(containerRef.current);
  }, []);

  const renderCustomNode = useCallback(
    ({ nodeDatum }: { nodeDatum: TreeNodeDatum }) => {
      const attrs = nodeDatum.attributes as unknown as OrgNodeAttributes;
      if (!attrs.personId) {
        // Virtual root node
        return (
          <foreignObject width={220} height={56} x={-110} y={-28}>
            <div className="flex h-full items-center justify-center rounded-lg border bg-card px-3 py-2 shadow-sm">
              <span className="text-sm font-semibold">{nodeDatum.name}</span>
            </div>
          </foreignObject>
        );
      }

      const isHighlighted = searchMatch?.id === attrs.personId;

      return (
        <OrgChartPersonCard
          personId={attrs.personId}
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

  // Determine tree depth: expand all if searching, otherwise use toggle
  const effectiveExpandAll = expandAll || (hasSearchInput && !!searchMatch);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Org Chart"
        subtitle={`${people.length} active staff`}
        actions={
          <div className="flex items-center gap-2">
            {/* Search input with clear button */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 pl-9 pr-8 h-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Department filter — Shadcn Select */}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {activeDepartments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DEPARTMENT_CONFIG[d as Department]?.label ?? d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

      {/* Search result / no-match indicator */}
      {hasSearchInput && searchMatch && (
        <p className="text-sm text-muted-foreground">
          Found: <span className="font-medium text-foreground">{searchMatch.full_name}</span>
          {searchMatch.job_title && ` — ${searchMatch.job_title}`}
        </p>
      )}
      {hasSearchInput && !searchMatch && (
        <p className="text-sm text-muted-foreground">
          No matches found for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {/* Department legend */}
      {activeDepartments.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {activeDepartments.map((d) => {
            const config = DEPARTMENT_CONFIG[d as Department];
            if (!config) return null;
            return (
              <div key={d} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: config.colour }}
                />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        role="img"
        aria-label={`Organisation chart showing ${people.length} staff members${departmentFilter !== "all" ? ` in ${DEPARTMENT_CONFIG[departmentFilter as Department]?.label ?? departmentFilter}` : ""}`}
        aria-roledescription="organisation chart"
        className="relative h-[calc(100vh-260px)] min-h-[400px] overflow-hidden rounded-lg border bg-background"
      >
        {translate.x > 0 && (
          <Tree
            data={treeData}
            orientation="vertical"
            pathFunc="diagonal"
            translate={translate}
            nodeSize={{ x: 280, y: 140 }}
            separation={{ siblings: 1.3, nonSiblings: 1.6 }}
            renderCustomNodeElement={renderCustomNode}
            initialDepth={effectiveExpandAll ? undefined : 2}
            key={`${departmentFilter}-${effectiveExpandAll}`}
            zoomable
            draggable
            collapsible
            hasInteractiveNodes
            pathClassFunc={() => "stroke-border !stroke-[1.5]"}
            scaleExtent={{ min: 0.1, max: 3 }}
          />
        )}

        {/* Zoom controls — bottom-right overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background shadow-sm"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background shadow-sm"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background shadow-sm"
            onClick={handleFitToScreen}
            aria-label="Fit to screen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
