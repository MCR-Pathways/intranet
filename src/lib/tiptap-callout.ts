import { Node } from "@tiptap/core";
import type { ComponentType } from "react";
import {
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

export type CalloutType = "info" | "warning" | "tip" | "danger";

export interface CalloutStyleConfig {
  label: string;
  icon: ComponentType<{ className?: string }>;
  bg: string;
  border: string;
}

/**
 * Shared callout UI config — single source of truth for both the
 * article composer toolbar and the article renderer.
 */
export const CALLOUT_CONFIG: Record<CalloutType, CalloutStyleConfig> = {
  info: { label: "Info", icon: Info, bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-400" },
  tip: { label: "Tip", icon: Lightbulb, bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-400" },
  warning: { label: "Warning", icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-400" },
  danger: { label: "Danger", icon: AlertCircle, bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-400" },
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: CalloutType) => ReturnType;
      toggleCallout: (type: CalloutType) => ReturnType;
    };
  }
}

/**
 * Custom Tiptap node for callout/admonition blocks.
 *
 * Renders as <div data-callout-type="info|warning|tip|danger">content</div>.
 * Follows the official Tiptap admonition pattern:
 * https://tiptap.dev/docs/editor/markdown/guides/create-a-admonition-block
 *
 * 4 types matching Confluence/GitBook conventions:
 * - info (blue) — general information
 * - warning (amber) — caution
 * - tip (green) — helpful advice
 * - danger (red) — critical warning
 */
export const Callout = Node.create({
  name: "callout",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info" as CalloutType,
        parseHTML: (element) =>
          (element.getAttribute("data-callout-type") as CalloutType) || "info",
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout-type]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, { type });
        },
      toggleCallout:
        (type: CalloutType) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, { type });
        },
    };
  },
});
