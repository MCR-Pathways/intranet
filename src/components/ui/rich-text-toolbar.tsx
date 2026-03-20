"use client";

import { type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  ImageIcon,
  Video as VideoIcon,
  Code,
  Link as LinkIcon,
  CheckSquare,
} from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { RichTextEditorPreset } from "./rich-text-editor";
import { useCallback } from "react";

interface RichTextToolbarProps {
  editor: Editor;
  preset: RichTextEditorPreset;
  onImageUpload?: (file: File) => Promise<string | null>;
}

export function RichTextToolbar({ editor, preset, onImageUpload }: RichTextToolbarProps) {
  const isFull = preset === "full";
  const isStandard = preset === "standard" || isFull;

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    // update link
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addVideo = useCallback(() => {
    const url = window.prompt("Video URL (YouTube, Vimeo, or Loom)");

    if (url) {
      editor.chain().focus().setVideo({ src: url }).run();
    }
  }, [editor]);

  const handleImageClick = useCallback(() => {
    if (onImageUpload) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        if (input.files?.length) {
          const file = input.files[0];
          const url = await onImageUpload(file);
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }
      };
      input.click();
    } else {
      const url = window.prompt("Image URL");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  }, [editor, onImageUpload]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-1">
      {/* Basic Formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Toggle bold"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Toggle italic"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("underline")}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Toggle underline"
      >
        <Underline className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Toggle bullet list"
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("orderedList")}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Toggle ordered list"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>

      {isFull && (
        <Toggle
          size="sm"
          pressed={editor.isActive("taskList")}
          onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
          aria-label="Toggle task list"
        >
          <CheckSquare className="h-4 w-4" />
        </Toggle>
      )}

      {/* Standard+ Formatting */}
      {isStandard && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />

          <Toggle
            size="sm"
            pressed={editor.isActive("heading", { level: 2 })}
            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label="Toggle heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("heading", { level: 3 })}
            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            aria-label="Toggle heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Toggle>
          
          <Toggle
            size="sm"
            pressed={editor.isActive("blockquote")}
            onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
            aria-label="Toggle blockquote"
          >
            <Quote className="h-4 w-4" />
          </Toggle>

          <Toggle
            size="sm"
            pressed={editor.isActive("link")}
            onPressedChange={setLink}
            aria-label="Toggle link"
          >
            <LinkIcon className="h-4 w-4" />
          </Toggle>

          {isFull && (
            <Toggle
              size="sm"
              pressed={editor.isActive("codeBlock")}
              onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
              aria-label="Toggle code block"
            >
              <Code className="h-4 w-4" />
            </Toggle>
          )}
        </>
      )}

      {/* Full Formatting (Media) */}
      {isFull && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleImageClick}
            aria-label="Insert image"
            type="button"
            className="h-8 w-8 p-0"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={addVideo}
            aria-label="Insert video embed"
            type="button"
            className="h-8 w-8 p-0"
          >
            <VideoIcon className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
