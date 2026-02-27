"use client";

import { Fragment } from "react";
import { linkifyText } from "@/lib/url";
import type { TiptapDocument, TiptapNode } from "@/lib/tiptap";

interface TiptapRendererProps {
  /** Tiptap JSON content (preferred). Accepts TiptapDocument or generic Record from DB types. */
  json?: TiptapDocument | Record<string, unknown> | null;
  /** Plain text fallback for old posts without content_json */
  fallback?: string;
}

/**
 * Renders Tiptap JSON content as React elements.
 * Falls back to linkifyText(plainText) when json is null (backward compat).
 *
 * Why client-side rendering instead of generateHTML()?
 * - Avoids adding isomorphic-dompurify / server-only HTML sanitisation
 * - Re-uses existing linkifyText for plain text nodes
 * - Mention nodes render as styled spans with no XSS risk (data from our DB)
 * - Zero extra bundle size — just React elements
 */
export function TiptapRenderer({ json, fallback }: TiptapRendererProps) {
  // Backward compat: old posts only have plain text content
  if (!json) {
    if (!fallback) return null;
    return (
      <div className="whitespace-pre-wrap text-sm break-words">
        {linkifyText(fallback)}
      </div>
    );
  }

  // Cast generic Record to TiptapDocument (safe — JSON shape is validated on write)
  const doc = json as TiptapDocument;

  return (
    <div className="text-sm break-words [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:ml-4">
      {doc.content?.map((node, i) => (
        <RenderNode key={i} node={node} />
      ))}
    </div>
  );
}

function RenderNode({ node }: { node: TiptapNode }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap">
          {node.content?.map((child, i) => (
            <RenderInline key={i} node={child} />
          )) ?? <br />}
        </p>
      );

    case "bulletList":
      return (
        <ul className="list-disc pl-4">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </ul>
      );

    case "orderedList":
      return (
        <ol className="list-decimal pl-4">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </ol>
      );

    case "listItem":
      return (
        <li>
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </li>
      );

    case "hardBreak":
      return <br />;

    default:
      // Unknown block types: try rendering children
      if (node.content) {
        return (
          <>
            {node.content.map((child, i) => (
              <RenderNode key={i} node={child} />
            ))}
          </>
        );
      }
      return null;
  }
}

function RenderInline({ node }: { node: TiptapNode }) {
  // Mention node
  if (node.type === "mention") {
    const label = (node.attrs?.label as string) ?? (node.attrs?.id as string) ?? "";
    return (
      <span className="text-primary font-medium">@{label}</span>
    );
  }

  // Hard break inside inline
  if (node.type === "hardBreak") {
    return <br />;
  }

  // Text node (possibly with marks)
  if (node.type === "text") {
    const text = node.text ?? "";
    let element: React.ReactNode = text;

    // Apply marks (bold, italic, link, strike, code)
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case "bold":
            element = <strong>{element}</strong>;
            break;
          case "italic":
            element = <em>{element}</em>;
            break;
          case "strike":
            element = <s>{element}</s>;
            break;
          case "code":
            element = (
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                {element}
              </code>
            );
            break;
          case "link": {
            const href = mark.attrs?.href as string;
            if (
              href &&
              (href.startsWith("http://") || href.startsWith("https://"))
            ) {
              element = (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                >
                  {element}
                </a>
              );
            }
            break;
          }
        }
      }
    }

    return <Fragment>{element}</Fragment>;
  }

  // Fallback: try rendering as block node
  return <RenderNode node={node} />;
}
