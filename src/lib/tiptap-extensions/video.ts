import { Node, mergeAttributes } from "@tiptap/core";

export interface VideoOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      /**
       * Insert a video embed
       */
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: "video",

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: {
        class: "w-full aspect-video rounded-lg overflow-hidden border-0",
      },
    };
  },

  inline: false,
  group: "block",
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src*="youtube"]',
      },
      {
        tag: 'iframe[src*="vimeo"]',
      },
      {
        tag: 'iframe[src*="loom"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      this.options.HTMLAttributes,
      [
        "iframe",
        mergeAttributes(HTMLAttributes, {
          width: "100%",
          height: "100%",
          allowfullscreen: this.options.allowFullscreen ? "true" : "false",
        }),
      ],
    ];
  },

  addCommands() {
    return {
      setVideo:
        (options: { src: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
