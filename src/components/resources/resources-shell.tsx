"use client";

import { usePathname } from "next/navigation";
import { ResourceTree } from "./resource-tree";
import type { CategoryTreeNode } from "@/types/database.types";

interface ResourcesShellProps {
  categories: CategoryTreeNode[];
  canEdit: boolean;
  children: React.ReactNode;
}

export function ResourcesShell({
  categories,
  canEdit,
  children,
}: ResourcesShellProps) {
  const pathname = usePathname();

  return (
    <div
      className="flex bg-card shadow-md rounded-xl overflow-clip"
      style={{ minHeight: "calc(100vh - 14rem)" }}
    >
      <ResourceTree
        categories={categories}
        currentPath={pathname}
        canEdit={canEdit}
      />
      <div className="flex-1 p-6 md:p-7 overflow-y-auto min-w-0">
        {children}
      </div>
    </div>
  );
}
