/**
 * Server-side read-only renderer for native Plate articles.
 *
 * Uses PlateStatic (RSC-safe, zero client JS) with Base* plugins.
 * Renders inside the same prose container as Google Doc articles
 * for visual parity.
 */

import type { Value } from "platejs";
import {
  createStaticEditor,
  PlateStatic,
  SlateElement,
  SlateLeaf,
} from "platejs/static";
import {
  BaseHeadingPlugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
} from "@platejs/basic-nodes";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin } from "@platejs/list";
import type { SlateElementProps, SlateLeafProps } from "platejs/static";

// =============================================
// STATIC ELEMENT COMPONENTS
// =============================================

function ParagraphStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="p" />;
}

function BlockquoteStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="blockquote" />;
}

function H1Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h1" />;
}

function H2Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h2" />;
}

function H3Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h3" />;
}

function H4Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h4" />;
}

function HrStatic(props: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <hr />
      {props.children}
    </SlateElement>
  );
}

function LinkStatic({ children, element, ...props }: SlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  return (
    <SlateElement element={element} {...props}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </SlateElement>
  );
}

// =============================================
// STATIC LEAF COMPONENTS
// =============================================

function BoldStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="strong" />;
}

function ItalicStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="em" />;
}

function UnderlineStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="u" />;
}

function StrikethroughStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="s" />;
}

// =============================================
// RENDERER
// =============================================

interface PlateStaticViewProps {
  value: Value;
  className?: string;
}

export function PlateStaticView({ value, className }: PlateStaticViewProps) {
  const editor = createStaticEditor({
    plugins: [
      BaseHeadingPlugin,
      BaseBlockquotePlugin,
      BaseHorizontalRulePlugin,
      BaseBoldPlugin,
      BaseItalicPlugin,
      BaseUnderlinePlugin,
      BaseStrikethroughPlugin,
      BaseLinkPlugin,
      BaseListPlugin,
    ],
    value,
    override: {
      components: {
        p: ParagraphStatic,
        blockquote: BlockquoteStatic,
        h1: H1Static,
        h2: H2Static,
        h3: H3Static,
        h4: H4Static,
        hr: HrStatic,
        a: LinkStatic,
        bold: BoldStatic,
        italic: ItalicStatic,
        underline: UnderlineStatic,
        strikethrough: StrikethroughStatic,
      },
    },
  });

  return <PlateStatic editor={editor} className={className} />;
}
