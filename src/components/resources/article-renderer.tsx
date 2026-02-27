"use client";

import { Fragment } from "react";
import { linkifyText } from "@/lib/url";
import type { TiptapDocument, TiptapNode } from "@/lib/tiptap";

interface ArticleRendererProps {
  /** Tiptap JSON content */
  json?: TiptapDocument | Record<string, unknown> | null;
  /** Plain text fallback */
  fallback?: string;
}

/**
 * Renders article Tiptap JSON with full prose typography.
 * Supports headings, blockquotes, horizontal rules (unlike the feed renderer).
 */
export function ArticleRenderer({ json, fallback }: ArticleRendererProps) {
  if (!json) {
    if (!fallback) return null;
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words">
        {linkifyText(fallback)}
      </div>
    );
  }

  const doc = json as TiptapDocument;

  return (
    <div className="prose prose-sm max-w-none break-words">
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

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const children = node.content?.map((child, i) => (
        <RenderInline key={i} node={child} />
      ));
      if (level === 2)
        return <h2 className="text-xl font-bold mt-6 mb-2">{children}</h2>;
      return <h3 className="text-lg font-semibold mt-4 mb-1">{children}</h3>;
    }

    case "blockquote":
      return (
        <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-3">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </blockquote>
      );

    case "bulletList":
      return (
        <ul className="list-disc pl-6 my-2">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </ul>
      );

    case "orderedList":
      return (
        <ol className="list-decimal pl-6 my-2">
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

    case "horizontalRule":
      return <hr className="my-4 border-muted" />;

    case "hardBreak":
      return <br />;

    default:
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
  if (node.type === "hardBreak") return <br />;

  if (node.type === "text") {
    const text = node.text ?? "";
    let element: React.ReactNode = text;

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
              (/^https?:\/\//i.test(href))
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

  return <RenderNode node={node} />;
}
