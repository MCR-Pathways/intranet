import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { MentionList, type MentionListRef, type MentionUser } from "./mention-list";

/**
 * Creates a Tiptap Mention suggestion configuration.
 * Filters a pre-loaded list of all active profiles client-side (instant for 80+ people).
 *
 * @param allUsers - All active users, pre-loaded once on component mount
 */
export function createMentionSuggestion(
  allUsers: MentionUser[]
): Omit<SuggestionOptions<MentionUser>, "editor"> {
  return {
    items: ({ query }) => {
      const lower = query.toLowerCase();
      return allUsers
        .filter((u) => u.label.toLowerCase().includes(lower))
        .slice(0, 8);
    },

    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: HTMLDivElement | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          popup = document.createElement("div");
          popup.style.position = "absolute";
          popup.style.zIndex = "50";
          document.body.appendChild(popup);
          popup.appendChild(component.element);

          const rect = props.clientRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }
        },

        onUpdate: (props) => {
          component?.updateProps(props);

          const rect = props.clientRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }
        },

        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            popup?.remove();
            popup = null;
            component?.destroy();
            component = null;
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          popup?.remove();
          popup = null;
          component?.destroy();
          component = null;
        },
      };
    },
  };
}
