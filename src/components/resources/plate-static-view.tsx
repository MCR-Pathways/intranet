/**
 * Server-side read-only renderer for native Plate articles.
 *
 * Uses PlateStatic (RSC-safe, zero client JS). Plugin registry
 * and static components live in plate-static-plugins.tsx (shared
 * with the HTML serialisation pipeline in native-actions.ts).
 */

import type { Value } from "platejs";
import { PlateStatic } from "platejs/static";
import { createNativeStaticEditor } from "@/lib/plate-static-plugins";

interface PlateStaticViewProps {
  value: Value;
  className?: string;
}

export function PlateStaticView({ value, className }: PlateStaticViewProps) {
  const editor = createNativeStaticEditor(value);

  return <PlateStatic editor={editor} className={className} />;
}
