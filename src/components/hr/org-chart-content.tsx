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
  ChevronRight,
  Home,
} from "lucide-react";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";

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
  totalReportCount: number;
  isAncestor: boolean; // true if this node is included only as an ancestor (not in the filtered department)
  hasChildren: boolean;
}

/**
 * Build an ancestor-inclusive filtered set.
 * When filtering by department, include all people in that department
 * PLUS their ancestors up to the CEO. This preserves the tree hierarchy
 * instead of creating disconnected roots that need a virtual node.
 */
function getFilteredPeopleWithAncestors(
  people: OrgPerson[],
  departmentFilter: string,
): { filtered: OrgPerson[]; ancestorIds: Set<string> } {
  if (departmentFilter === "all") {
    return { filtered: people, ancestorIds: new Set() };
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const deptPeople = people.filter((p) => p.department === departmentFilter);
  const ancestorIds = new Set<string>();
  const includedIds = new Set(deptPeople.map((p) => p.id));

  // Walk up the manager chain for each department member
  for (const person of deptPeople) {
    let current = person;
    while (current.line_manager_id) {
      if (includedIds.has(current.line_manager_id)) break;
      const parent = byId.get(current.line_manager_id);
      if (!parent) break;
      includedIds.add(parent.id);
      ancestorIds.add(parent.id);
      current = parent;
    }
  }

  return {
    filtered: people.filter((p) => includedIds.has(p.id)),
    ancestorIds,
  };
}

/**
 * Count total descendants (not just direct children) for display.
 */
function countDescendants(
  personId: string,
  childrenMap: Map<string | null, OrgPerson[]>,
): number {
  const children = childrenMap.get(personId) ?? [];
  let count = children.length;
  for (const child of children) {
    count += countDescendants(child.id, childrenMap);
  }
  return count;
}

function buildTree(
  people: OrgPerson[],
  onLeaveSet: Set<string>,
  ancestorIds: Set<string>,
): RawNodeDatum | RawNodeDatum[] | null {
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
        totalReportCount: countDescendants(person.id, childrenMap),
        isAncestor: ancestorIds.has(person.id),
        hasChildren: children.length > 0,
      } as Record<string, string | number | boolean>,
      children: children.map(toNode),
    };
  }

  // Single root → return single node. Multiple → return array (react-d3-tree supports it)
  if (roots.length === 1) {
    return toNode(roots[0]);
  }

  return roots.map(toNode);
}

/**
 * Build a subtree rooted at a specific person.
 * Used for "focus mode" — clicking into a person's subtree.
 */
function buildSubtree(
  rootPerson: OrgPerson,
  people: OrgPerson[],
  onLeaveSet: Set<string>,
): RawNodeDatum | null {
  const childrenMap = new Map<string | null, OrgPerson[]>();
  for (const person of people) {
    const parent = person.line_manager_id;
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(person);
  }

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
        totalReportCount: countDescendants(person.id, childrenMap),
        isAncestor: false,
        hasChildren: children.length > 0,
      } as Record<string, string | number | boolean>,
      children: children.map(toNode),
    };
  }

  return toNode(rootPerson);
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
    const svgSelection = select(svg);
    const currentTransform =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (svg as any).__zoom ?? zoomIdentity;

    const newScale = currentTransform.k * scaleBy;
    if (newScale < 0.1 || newScale > 3) return;

    const midX = svg.clientWidth / 2;
    const midY = svg.clientHeight / 2;

    const newTransform = zoomIdentity
      .translate(midX, midY)
      .scale(newScale)
      .translate(
        -midX + (currentTransform.x - midX * (1 - currentTransform.k)) / currentTransform.k,
        -midY + (currentTransform.y - midY * (1 - currentTransform.k)) / currentTransform.k,
      );

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

    const bbox = g.getBBox();
    const svgWidth = svg.clientWidth;
    const svgHeight = svg.clientHeight;

    const padding = 60;
    const scaleX = (svgWidth - padding * 2) / bbox.width;
    const scaleY = (svgHeight - padding * 2) / bbox.height;
    const scale = Math.min(scaleX, scaleY, 1.2);

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
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 60 });
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | undefined>(undefined);

  const onLeaveSet = useMemo(() => new Set(onLeaveIds), [onLeaveIds]);

  // Dynamically centre the tree and set dimensions for click-to-centre
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      setTranslate({ x: el.clientWidth / 2, y: 80 });
      setDimensions({ width: el.clientWidth, height: el.clientHeight });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build focused person's breadcrumb trail
  const focusBreadcrumbs = useMemo(() => {
    if (!focusedPersonId) return [];
    const byId = new Map(people.map((p) => [p.id, p]));
    const trail: OrgPerson[] = [];
    let current = byId.get(focusedPersonId);
    while (current) {
      trail.unshift(current);
      current = current.line_manager_id ? byId.get(current.line_manager_id) : undefined;
    }
    return trail;
  }, [focusedPersonId, people]);

  // Filter people by department (with ancestor chain preservation)
  const { filteredPeople, ancestorIds } = useMemo(() => {
    const { filtered, ancestorIds } = getFilteredPeopleWithAncestors(people, departmentFilter);
    return { filteredPeople: filtered, ancestorIds };
  }, [people, departmentFilter]);

  // Build tree data — either focused subtree or full tree
  const treeData = useMemo(() => {
    if (focusedPersonId) {
      const focusedPerson = people.find((p) => p.id === focusedPersonId);
      if (focusedPerson) {
        return buildSubtree(focusedPerson, filteredPeople, onLeaveSet);
      }
    }
    return buildTree(filteredPeople, onLeaveSet, ancestorIds);
  }, [filteredPeople, onLeaveSet, ancestorIds, focusedPersonId, people]);

  // Get unique departments for filter and legend
  const activeDepartments = useMemo(() => {
    const depts = new Set<string>();
    people.forEach((p) => {
      if (p.department) depts.add(p.department);
    });
    return Array.from(depts).sort();
  }, [people]);

  // Search: find matching people
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return people.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.job_title && p.job_title.toLowerCase().includes(q))
    );
  }, [searchQuery, people]);

  const searchMatch = searchMatches.length > 0 ? searchMatches[0] : null;
  const hasSearchInput = searchQuery.trim().length > 0;

  // Auto-focus on search match's manager so the person is visible in context
  useEffect(() => {
    if (!searchMatch) return;
    // Focus on the matched person's manager (so we see them + siblings)
    // If they have no manager (CEO), focus on them directly
    const focusTarget = searchMatch.line_manager_id ?? searchMatch.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusedPersonId(focusTarget);
  }, [searchMatch]);

  // Find Me — locate current user
  const handleFindMe = useCallback(() => {
    const me = people.find((p) => p.id === currentUserId);
    if (me) {
      setSearchQuery(me.full_name);
      setExpandAll(true);
    }
  }, [people, currentUserId]);

  // Clear search and exit focus mode
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setFocusedPersonId(null);
  }, []);

  // Focus on a person's subtree (drill down)
  const handleFocusPerson = useCallback((personId: string) => {
    setFocusedPersonId(personId);
    setSearchQuery("");
    setExpandAll(true);
    // Reset translate to re-centre
    if (containerRef.current) {
      setTranslate({ x: containerRef.current.clientWidth / 2, y: 80 });
    }
  }, []);

  // Exit focus mode (back to full tree)
  const handleExitFocus = useCallback(() => {
    setFocusedPersonId(null);
    if (containerRef.current) {
      setTranslate({ x: containerRef.current.clientWidth / 2, y: 80 });
    }
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
    ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
      const attrs = nodeDatum.attributes as unknown as OrgNodeAttributes;

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
          totalReportCount={attrs.totalReportCount}
          isHighlighted={isHighlighted}
          isAncestor={attrs.isAncestor}
          hasChildren={attrs.hasChildren}
          isCollapsed={nodeDatum.__rd3t?.collapsed ?? false}
          onToggleExpand={toggleNode}
          onFocus={handleFocusPerson}
        />
      );
    },
    [searchMatch, handleFocusPerson]
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
    <div className="space-y-3">
      <PageHeader
        title="Org Chart"
        subtitle={`${people.length} people across the organisation`}
        actions={
          <div className="flex items-center gap-2">
            {/* Search input with clear button */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or title..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // Reset department filter when searching so the matched person is visible
                  if (e.target.value.trim()) {
                    setDepartmentFilter("all");
                  } else {
                    // Clearing search → exit focus mode
                    setFocusedPersonId(null);
                  }
                }}
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
            <Select value={departmentFilter} onValueChange={(val) => {
              setDepartmentFilter(val);
              setFocusedPersonId(null); // Reset focus when changing department
              setSearchQuery(""); // Clear search when filtering by department
            }}>
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
      {hasSearchInput && searchMatches.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Found {searchMatches.length} {searchMatches.length === 1 ? "match" : "matches"}:
          </span>
          <span className="font-medium text-foreground">{searchMatch!.full_name}</span>
          {searchMatch!.job_title && (
            <span className="text-muted-foreground">— {searchMatch!.job_title}</span>
          )}
          {searchMatches.length > 1 && (
            <span className="text-xs text-muted-foreground">(+{searchMatches.length - 1} more)</span>
          )}
        </div>
      )}
      {hasSearchInput && searchMatches.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No matches found for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {/* Focus mode breadcrumbs */}
      {focusedPersonId && focusBreadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={handleExitFocus}
            className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            Full Org
          </button>
          {focusBreadcrumbs.map((person, i) => (
            <span key={person.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              {i === focusBreadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{person.full_name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleFocusPerson(person.id)}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  {person.full_name}
                </button>
              )}
            </span>
          ))}
        </div>
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
        className="relative h-[calc(100vh-260px)] min-h-[500px] overflow-hidden rounded-xl border bg-muted/30"
      >
        {translate.x > 0 && (
          <Tree
            data={treeData}
            orientation="vertical"
            pathFunc="diagonal"
            translate={translate}
            dimensions={dimensions}
            centeringTransitionDuration={600}
            nodeSize={{ x: 300, y: 170 }}
            separation={{ siblings: 1.2, nonSiblings: 1.5 }}
            renderCustomNodeElement={renderCustomNode}
            initialDepth={effectiveExpandAll ? undefined : 2}
            key={`${departmentFilter}-${effectiveExpandAll}-${focusedPersonId ?? "root"}`}
            zoomable
            draggable
            collapsible
            hasInteractiveNodes
            shouldCollapseNeighborNodes
            enableLegacyTransitions
            transitionDuration={300}
            pathClassFunc={() => "org-chart-link"}
            scaleExtent={{ min: 0.1, max: 3 }}
          />
        )}

        {/* Zoom controls — bottom-right overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-sm"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-sm"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-sm"
            onClick={handleFitToScreen}
            aria-label="Fit to screen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>

        {/* Keyboard hint */}
        <div className="absolute bottom-4 left-4 text-[11px] text-muted-foreground/60">
          Scroll to zoom · Drag to pan · Click card to view profile
        </div>
      </div>

      {/* Global styles for connector lines */}
      <style>{`
        .org-chart-link {
          stroke: #94a3b8;
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      `}</style>
    </div>
  );
}
