import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutType = "info" | "warning" | "tip" | "danger";

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
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout-type": HTMLAttributes["data-callout-type"] }),
      0,
    ];
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
