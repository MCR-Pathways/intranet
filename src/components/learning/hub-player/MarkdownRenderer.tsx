'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memo, useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  title?: string;
  onHeadingsExtracted?: (headings: { id: string; text: string; level: number }[]) => void;
  // Resolve a `![alt](GENERATE_IMAGE)` placeholder's alt to a signed image URL.
  // Used by published consumption; undefined => not (yet) generated, so the
  // placeholder is hidden entirely.
  resolveImage?: (altText: string) => string | undefined;
}

function MarkdownRenderer({
  content,
  title,
  onHeadingsExtracted,
  resolveImage,
}: MarkdownRendererProps) {
  const { processedContent } = useMemo(() => {
    const headingsArray: { id: string; text: string; level: number }[] = [];
    const lines = content.split('\n');

    // Find first H1 and check if it matches the title
    let firstH1Index = -1;
    let shouldRemoveFirstH1 = false;

    if (title) {
      const normalizeText = (text: string) =>
        text.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

      const normalizedTitle = normalizeText(title);

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^#\s+(.+)$/);
        if (match) {
          const h1Text = match[1].trim();
          if (normalizeText(h1Text) === normalizedTitle) {
            firstH1Index = i;
            shouldRemoveFirstH1 = true;
          }
          break;
        }
      }
    }

    // Process lines and extract headings
    const filteredLines: string[] = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        // Skip the first H1 if it matches the title
        if (shouldRemoveFirstH1 && index === firstH1Index) {
          return;
        }

        headingsArray.push({ id, text, level });
      }

      // Add line to filtered content unless it's the duplicate H1
      if (!(shouldRemoveFirstH1 && index === firstH1Index)) {
        filteredLines.push(line);
      }
    });

    if (onHeadingsExtracted) {
      onHeadingsExtracted(headingsArray);
    }

    return {
      processedContent: filteredLines.join('\n'),
      headings: headingsArray,
    };
  }, [content, title, onHeadingsExtracted]);

  // Memoised so ReactMarkdown sees a stable components reference; without this,
  // every parent render reruns the whole markdown render tree even when the
  // content hasn't changed.
  const components = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h1: ({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : children?.toString() || '';
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        return (
          <h1 id={id} className="group relative" {...props}>
            {children}
            <a
              href={`#${id}`}
              className="heading-anchor absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              #
            </a>
          </h1>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h2: ({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : children?.toString() || '';
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        return (
          <h2 id={id} className="group relative" {...props}>
            {children}
            <a
              href={`#${id}`}
              className="heading-anchor absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              #
            </a>
          </h2>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h3: ({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : children?.toString() || '';
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        return (
          <h3 id={id} className="group relative" {...props}>
            {children}
            <a
              href={`#${id}`}
              className="heading-anchor absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              #
            </a>
          </h3>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h4: ({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : children?.toString() || '';
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        return (
          <h4 id={id} className="group relative" {...props}>
            {children}
            <a
              href={`#${id}`}
              className="heading-anchor absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              #
            </a>
          </h4>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h5: ({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : children?.toString() || '';
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        return (
          <h5 id={id} className="group relative" {...props}>
            {children}
            <a
              href={`#${id}`}
              className="heading-anchor absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              #
            </a>
          </h5>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h6: ({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : children?.toString() || '';
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        return (
          <h6 id={id} className="group relative" {...props}>
            {children}
            <a
              href={`#${id}`}
              className="heading-anchor absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              #
            </a>
          </h6>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      a: ({ href, children, ...props }: any) => {
        const isExternal = href?.startsWith('http');
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            {...props}
          >
            {children}
          </a>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pre: ({ children, ...props }: any) => (
        <pre className="overflow-x-auto rounded-lg border bg-muted p-4" {...props}>
          {children}
        </pre>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code: ({ className, children, ...props }: any) => {
        const lang = className?.match(/(?:^|\s)language-(\S+)/)?.[1];
        // v1 does not render live Mermaid — show the diagram source in a
        // styled code block rather than a rendered diagram.
        if (lang === 'mermaid') {
          return (
            <pre className="overflow-x-auto rounded-lg border bg-muted p-4">
              <code className="language-mermaid text-sm">
                {String(children).replace(/\n$/, '')}
              </code>
            </pre>
          );
        }
        const isInline = !className;
        return (
          <code
            className={isInline ? 'rounded bg-muted px-1.5 py-0.5 text-sm' : className}
            {...props}
          >
            {children}
          </code>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      table: ({ children, ...props }: any) => (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border" {...props}>
            {children}
          </table>
        </div>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      th: ({ children, ...props }: any) => (
        <th className="border border-border bg-muted p-2 text-left font-semibold" {...props}>
          {children}
        </th>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      td: ({ children, ...props }: any) => (
        <td className="border border-border p-2" {...props}>
          {children}
        </td>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockquote: ({ children, ...props }: any) => (
        <blockquote
          className="border-l-4 border-primary pl-4 italic text-muted-foreground"
          {...props}
        >
          {children}
        </blockquote>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      img: ({ src, alt, ...props }: any) => {
        const altText = typeof alt === 'string' ? alt : '';
        if (src === 'GENERATE_IMAGE') {
          // Generated? Render the real (signed) image. Otherwise the unresolved
          // placeholder is hidden entirely on the learner runtime.
          const resolved = resolveImage?.(altText);
          if (resolved) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolved}
                alt={altText}
                className="rounded-lg border max-w-full h-auto"
                loading="lazy"
              />
            );
          }
          return null;
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={altText}
            className="rounded-lg border max-w-full h-auto"
            loading="lazy"
            {...props}
          />
        );
      },
    }),
    [resolveImage]
  );

  // react-markdown v10 removed the `className` prop from the component itself
  // (it was deprecated in v9), so the prose styling lives on a wrapping element.
  return (
    <div className="prose prose-base max-w-none dark:prose-invert prose-p:text-base prose-li:text-base prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// Memoised: ReactMarkdown re-parses on every render, so without this a parent
// re-render (e.g. a sibling lesson generating media, or composer keystrokes)
// would re-parse every lesson's markdown. Props are stable per lesson, so memo
// lets unrelated re-renders skip the re-parse entirely.
export default memo(MarkdownRenderer);
