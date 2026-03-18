"use client";

import { createElement, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CategoryTreeNode } from "@/types/database.types";

// ─── localStorage keys ──────────────────────────────────────────────────────

const EXPANDED_KEY = "resources-tree-expanded";
const COLLAPSED_KEY = "resources-tree-collapsed";
const TREE_EVENT = "mcr-resources-tree";

// ─── useSyncExternalStore for localStorage (same pattern as app-layout.tsx) ──

function subscribeTree(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === EXPANDED_KEY ||
      event.key === COLLAPSED_KEY ||
      event.key === null
    ) {
      callback();
    }
  };
  window.addEventListener(TREE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(TREE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getExpandedSnapshot(): string {
  try {
    return localStorage.getItem(EXPANDED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getCollapsedSnapshot(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function getCollapsedSnapshotString(): string {
  return getCollapsedSnapshot() ? "true" : "false";
}

const SERVER_EXPANDED = "[]";
const SERVER_COLLAPSED = "false";

function dispatchTreeEvent() {
  window.dispatchEvent(new CustomEvent(TREE_EVENT));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function flattenExpandable(categories: CategoryTreeNode[]): string[] {
  const ids: string[] = [];
  function walk(nodes: CategoryTreeNode[]) {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  }
  walk(categories);
  return ids;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ResourceTreeProps {
  categories: CategoryTreeNode[];
  currentPath: string;
  canEdit: boolean;
}

export function ResourceTree({
  categories,
  currentPath,
  canEdit,
}: ResourceTreeProps) {
  const router = useRouter();

  // Read localStorage state via useSyncExternalStore
  const expandedRaw = useSyncExternalStore(
    subscribeTree,
    getExpandedSnapshot,
    () => SERVER_EXPANDED
  );
  const collapsedRaw = useSyncExternalStore(
    subscribeTree,
    getCollapsedSnapshotString,
    () => SERVER_COLLAPSED
  );

  const expandedIds = useMemo<Set<string>>(() => {
    try {
      return new Set(JSON.parse(expandedRaw) as string[]);
    } catch {
      return new Set();
    }
  }, [expandedRaw]);

  const isCollapsed = collapsedRaw === "true";

  // Check if all expandable nodes are expanded
  const expandableIds = useMemo(
    () => flattenExpandable(categories),
    [categories]
  );
  const allExpanded =
    expandableIds.length > 0 &&
    expandableIds.every((id) => expandedIds.has(id));

  // ─── Actions ────────────────────────────────────────────────────────────

  const toggleExpanded = useCallback((categoryId: string) => {
    try {
      const current = new Set(
        JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]") as string[]
      );
      if (current.has(categoryId)) {
        current.delete(categoryId);
      } else {
        current.add(categoryId);
      }
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...current]));
      dispatchTreeEvent();
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleAll = useCallback(() => {
    try {
      if (allExpanded) {
        localStorage.setItem(EXPANDED_KEY, "[]");
      } else {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandableIds));
      }
      dispatchTreeEvent();
    } catch {
      // localStorage unavailable
    }
  }, [allExpanded, expandableIds]);

  const toggleCollapse = useCallback(() => {
    try {
      const next = !getCollapsedSnapshot();
      localStorage.setItem(COLLAPSED_KEY, String(next));
      dispatchTreeEvent();
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleCategoryClick = useCallback(
    (node: CategoryTreeNode) => {
      if (isCollapsed) {
        // Expand tree, navigate, and expand children
        try {
          localStorage.setItem(COLLAPSED_KEY, "false");
          if (node.children.length > 0) {
            const current = new Set(
              JSON.parse(
                localStorage.getItem(EXPANDED_KEY) ?? "[]"
              ) as string[]
            );
            current.add(node.id);
            localStorage.setItem(EXPANDED_KEY, JSON.stringify([...current]));
          }
          dispatchTreeEvent();
        } catch {
          // localStorage unavailable
        }
      } else if (node.children.length > 0) {
        toggleExpanded(node.id);
      }
      router.push(`/resources/${node.slugPath}`);
    },
    [isCollapsed, router, toggleExpanded]
  );

  // ─── Active state ──────────────────────────────────────────────────────

  const isActive = useCallback(
    (slugPath: string) => {
      const fullPath = `/resources/${slugPath}`;
      return currentPath === fullPath || currentPath.startsWith(fullPath + "/");
    },
    [currentPath]
  );

  // ─── Prefetch all category routes on mount ─────────────────────────────

  useEffect(() => {
    function prefetchAll(nodes: CategoryTreeNode[]) {
      for (const node of nodes) {
        router.prefetch(`/resources/${node.slugPath}`);
        if (node.children.length > 0) prefetchAll(node.children);
      }
    }
    prefetchAll(categories);
  }, [categories, router]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border transition-[width] duration-200 ease-in-out flex-shrink-0",
        isCollapsed ? "w-[52px]" : "w-[280px]"
      )}
    >
      {/* Tree header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border gap-1">
        {!isCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={toggleAll}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={allExpanded ? "Collapse all" : "Expand all"}
            >
              {allExpanded ? (
                <ChevronsDownUp className="h-4 w-4" />
              ) : (
                <ChevronsUpDown className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-auto"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Tree items */}
      <div className="flex-1 overflow-y-auto py-2">
        {categories.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            isCollapsed={isCollapsed}
            isActive={isActive}
            onCategoryClick={handleCategoryClick}
          />
        ))}
      </div>
    </aside>
  );
}

// ─── TreeNode (recursive) ───────────────────────────────────────────────────

interface TreeNodeProps {
  node: CategoryTreeNode;
  depth: number;
  expandedIds: Set<string>;
  isCollapsed: boolean;
  isActive: (slugPath: string) => boolean;
  onCategoryClick: (node: CategoryTreeNode) => void;
}

function TreeNode({
  node,
  depth,
  expandedIds,
  isCollapsed,
  isActive,
  onCategoryClick,
}: TreeNodeProps) {
  const active = isActive(node.slugPath);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const colour = resolveIconColour(node.icon_colour);

  // Use FolderOpen for categories with articles (macOS-style full vs empty folder)
  const baseIcon = resolveIcon(node.icon);
  const icon =
    baseIcon === Folder && node.article_count > 0 ? FolderOpen : baseIcon;

  const iconElement = createElement(icon, {
    className: "h-4 w-4",
  });

  // Collapsed mode: icon only with tooltip
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onCategoryClick(node)}
            className={cn(
              "flex items-center justify-center mx-1.5 my-0.5 p-1.5 rounded-lg transition-colors",
              active
                ? "bg-mcr-teal/10"
                : "hover:bg-muted"
            )}
          >
            <div
              className={cn(
                "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg",
                colour.bg,
                active ? "text-mcr-teal" : colour.fg
              )}
            >
              {iconElement}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {node.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded mode: full row with name and chevron
  return (
    <>
      <button
        onClick={() => onCategoryClick(node)}
        className={cn(
          "flex items-center gap-2.5 w-full text-left transition-colors",
          depth === 0
            ? "px-3.5 py-2 border-l-[3px]"
            : "px-3.5 py-1.5 border-l-[3px]",
          active
            ? "border-l-mcr-teal bg-mcr-teal/5"
            : "border-l-transparent hover:bg-muted"
        )}
        style={depth > 0 ? { paddingLeft: `${14 + depth * 28}px` } : undefined}
      >
        <div
          className={cn(
            "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg",
            colour.bg,
            active ? "text-mcr-teal" : colour.fg
          )}
        >
          {iconElement}
        </div>
        <span
          className={cn(
            "flex-1 text-[13px] font-medium truncate",
            active
              ? "text-mcr-teal font-semibold"
              : "text-foreground/80"
          )}
        >
          {node.name}
        </span>
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        )}
      </button>

      {/* Children (subcategories) */}
      {hasChildren && isExpanded && (
        <div
          className={cn(
            depth === 0 && "border-l-2 border-mcr-teal/15 ml-7"
          )}
        >
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              isCollapsed={isCollapsed}
              isActive={isActive}
              onCategoryClick={onCategoryClick}
            />
          ))}
        </div>
      )}
    </>
  );
}
