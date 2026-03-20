"use client";

import { Fragment } from "react";
import { isValidHttpUrl, linkifyText, proxyImageUrl } from "@/lib/url";
import { cn } from "@/lib/utils";
import { isValidHexColour } from "@/lib/validation";
import { CALLOUT_CONFIG } from "@/lib/tiptap-callout";
import { extractHeadings } from "@/lib/tiptap";
import type { TiptapDocument, TiptapNode } from "@/lib/tiptap";

interface LessonRendererProps {
  /** Tiptap JSON content */
  json?: TiptapDocument | Record<string, unknown> | null;
  /** Plain text fallback */
  fallback?: string;
}

/**
 * Renders lesson Tiptap JSON with full prose typography.
 * Supports headings, blockquotes, horizontal rules, tables, code blocks,
 * images, video embeds, callouts, task lists, text alignment, text colour,
 * highlight, subscript, superscript.
 */
export function LessonRenderer({ json, fallback }: LessonRendererProps) {
  if (!json) {
    if (!fallback) return null;
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words">
        {linkifyText(fallback)}
      </div>
    );
  }

  const doc = json as TiptapDocument;

  // Build heading ID list for anchor links
  const headings = extractHeadings(doc);
  let headingIndex = 0;

  return (
    <div className="prose prose-sm max-w-none break-words">
      {doc.content?.map((node, i) => {
        if (node.type === "heading") {
          const level = (node.attrs?.level as number) ?? 2;
          if (level >= 1 && level <= 4 && headingIndex < headings.length) {
            const heading = headings[headingIndex];
            headingIndex++;
            return (
              <RenderNode key={i} node={node} headingId={heading.id} />
            );
          }
        }
        return <RenderNode key={i} node={node} />;
      })}
    </div>
  );
}

function RenderNode({
  node,
  headingId,
}: {
  node: TiptapNode;
  headingId?: string;
}) {
  switch (node.type) {
    case "paragraph": {
      const textAlign = node.attrs?.textAlign as string | undefined;
      return (
        <p
          className="whitespace-pre-wrap"
          style={textAlign ? { textAlign: textAlign as React.CSSProperties["textAlign"] } : undefined}
        >
          {node.content?.map((child, i) => (
            <RenderInline key={i} node={child} />
          )) ?? <br />}
        </p>
      );
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const textAlign = node.attrs?.textAlign as string | undefined;
      const alignStyle = textAlign ? { textAlign: textAlign as React.CSSProperties["textAlign"] } : undefined;
      const children = node.content?.map((child, i) => (
        <RenderInline key={i} node={child} />
      ));
      if (level === 1)
        return (
          <h1
            id={headingId}
            className="text-2xl font-bold mt-6 mb-2 scroll-mt-20"
            style={alignStyle}
          >
            {children}
          </h1>
        );
      if (level === 2)
        return (
          <h2
            id={headingId}
            className="text-xl font-bold mt-5 mb-1.5 scroll-mt-20"
            style={alignStyle}
          >
            {children}
          </h2>
        );
      if (level === 3)
        return (
          <h3
            id={headingId}
            className="text-lg font-semibold mt-4 mb-1 scroll-mt-20"
            style={alignStyle}
          >
            {children}
          </h3>
        );
      return (
        <h4
          id={headingId}
          className="text-base font-semibold mt-3 mb-1 scroll-mt-20"
          style={alignStyle}
        >
          {children}
        </h4>
      );
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

    case "taskList":
      return (
        <ul className="list-none pl-0 my-2 space-y-1">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </ul>
      );

    case "taskItem": {
      const checked = node.attrs?.checked === true;
      return (
        <li className="flex gap-2 items-start">
          <input
            type="checkbox"
            checked={checked}
            disabled
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <div className="flex-1 min-w-0">
            {node.content?.map((child, i) => (
              <RenderNode key={i} node={child} />
            ))}
          </div>
        </li>
      );
    }

    case "horizontalRule":
      return <hr className="my-4 border-muted" />;

    case "table":
      return (
        <table className="border-collapse w-full my-4">
          <tbody>
            {node.content?.map((child, i) => (
              <RenderNode key={i} node={child} />
            ))}
          </tbody>
        </table>
      );

    case "tableRow":
      return (
        <tr>
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </tr>
      );

    case "tableHeader":
      return (
        <th className="border border-border p-2 bg-muted font-semibold text-left">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </th>
      );

    case "tableCell":
      return (
        <td className="border border-border p-2">
          {node.content?.map((child, i) => (
            <RenderNode key={i} node={child} />
          ))}
        </td>
      );

    case "codeBlock": {
      const language = (node.attrs?.language as string) ?? "";
      return (
        <pre className="rounded-lg bg-muted p-4 my-4 overflow-x-auto text-sm font-mono">
          <code className={language ? `language-${language}` : undefined}>
            {node.content?.map((child) => child.text).join("") ?? ""}
          </code>
        </pre>
      );
    }

    case "image": {
      const src = node.attrs?.src as string;
      const alt = (node.attrs?.alt as string) ?? "";
      if (
        src &&
        (isValidHttpUrl(src) || (src.startsWith("/") && !src.startsWith("//")))
      ) {
        const safeSrc = proxyImageUrl(src) ?? src;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeSrc}
            alt={alt}
            className="max-w-full h-auto rounded-lg my-4"
          />
        );
      }
      return null;
    }

    case "video": {
      const src = node.attrs?.src as string;
      if (!src) return null;
      if (
        src &&
        (isValidHttpUrl(src) || (src.startsWith("/") && !src.startsWith("//")))
      ) {
        return (
          <div className="relative w-full aspect-video my-4 rounded-lg overflow-hidden bg-black">
            <iframe
              src={src}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
      return null;
    }

    case "callout": {
      const calloutType = (node.attrs?.type as string) ?? "info";
      const style = Object.hasOwn(CALLOUT_CONFIG, calloutType)
        ? CALLOUT_CONFIG[calloutType as keyof typeof CALLOUT_CONFIG]
        : CALLOUT_CONFIG.info;
      const Icon = style.icon;
      return (
        <div
          className={cn("my-4 rounded-lg border-l-4 p-4", style.bg, style.border)}
        >
          <div className="flex gap-3">
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              {node.content?.map((child, i) => (
                <RenderNode key={i} node={child} />
              ))}
            </div>
          </div>
        </div>
      );
    }

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
          case "underline":
            element = <u>{element}</u>;
            break;
          case "code":
            element = (
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                {element}
              </code>
            );
            break;
          case "subscript":
            element = <sub>{element}</sub>;
            break;
          case "superscript":
            element = <sup>{element}</sup>;
            break;
          case "textStyle": {
            const color = mark.attrs?.color;
            if (typeof color === "string" && isValidHexColour(color)) {
              element = <span style={{ color }}>{element}</span>;
            }
            break;
          }
          case "highlight": {
            const bgColor = mark.attrs?.color;
            element = (
              <mark
                style={
                  typeof bgColor === "string" && isValidHexColour(bgColor)
                    ? { backgroundColor: bgColor }
                    : undefined
                }
              >
                {element}
              </mark>
            );
            break;
          }
          case "link": {
            const href = mark.attrs?.href as string;
            if (href && isValidHttpUrl(href)) {
              element = (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link underline hover:text-link/80"
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
