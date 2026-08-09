"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn, copyToClipboard } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

function sanitizeMarkdownUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Parse every value instead of trusting a scheme-shaped regular expression.
  // URL parsing also catches browser-normalized obfuscations such as embedded
  // ASCII tabs/newlines in `javascript:`. Relative URLs resolve against this
  // inert base and retain their original relative spelling when returned.
  try {
    const protocol = new URL(trimmed, "https://uetgpt.invalid/").protocol;
    return SAFE_URL_SCHEMES.has(protocol) ? trimmed : "";
  } catch {
    return "";
  }
}

function textFromReactNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromReactNode).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textFromReactNode(node.props.children);
  }
  return "";
}

function normalizeCodeForClipboard(value: string): string {
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}

function CodeBlock({
  language,
  code,
  children,
}: {
  language?: string;
  code: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    const success = await copyToClipboard(code);
    if (!success) return;

    setCopied(true);
    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 2_000);
  }, [code]);

  return (
    <div className="group/code relative my-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-base)]">
      <div className="flex min-h-9 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-3">
        <span className="truncate font-mono text-[11px] font-medium text-[var(--text-muted)]">
          {language || "text"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 px-2 text-[11px] text-[var(--text-muted)] opacity-80 hover:text-[var(--text-primary)] focus-visible:opacity-100 md:opacity-0 md:group-hover/code:opacity-100 md:group-focus-within/code:opacity-100"
          aria-label={copied ? "Code copied" : "Copy code"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--semantic-success)]" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed [tab-size:2] md:p-4 md:text-sm">
        {children}
      </pre>
    </div>
  );
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn("prose prose-sm max-w-none break-words", className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        urlTransform={sanitizeMarkdownUrl}
        components={{
          code({ className: codeClassName, children, node: _node, ...props }) {
            const isBlock =
              /\b(?:hljs|language-[\w-]+)\b/.test(codeClassName ?? "") ||
              textFromReactNode(children).includes("\n");

            if (!isBlock) {
              return (
                <code
                  className="rounded-[var(--radius-xs)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--text-primary)]"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code className={cn("font-mono", codeClassName)} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            const child = React.Children.toArray(children).find(React.isValidElement);
            const element = child as React.ReactElement<{
              className?: string;
              children?: React.ReactNode;
            }> | null;
            const language = element?.props.className?.match(/\blanguage-([\w-]+)/)?.[1];
            const code = normalizeCodeForClipboard(textFromReactNode(element?.props.children));

            return (
              <CodeBlock language={language} code={code}>
                {children}
              </CodeBlock>
            );
          },
          a({ href, children, node: _node, ...props }) {
            if (!href) return <span>{children}</span>;
            const external = /^(?:https?:)?\/\//i.test(href);

            return (
              <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer nofollow" : undefined}
                className="text-[var(--accent)] underline decoration-[var(--accent-muted)] underline-offset-2 transition-colors hover:decoration-[var(--accent)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                {...props}
              >
                {children}
                {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
              </a>
            );
          },
          img({ src, alt, node: _node, ...props }) {
            if (!src) return null;
            return (
              <img
                {...props}
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="my-4 h-auto max-w-full rounded-[var(--radius-md)] border border-[var(--border)]"
              />
            );
          },
          ul({ children }) {
            return (
              <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-[var(--text-muted)]">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-[var(--text-muted)]">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return (
              <li className="pl-1 text-[var(--chat-font-size,0.875rem)] leading-relaxed text-[var(--text-primary)]">
                {children}
              </li>
            );
          },
          p({ children }) {
            return (
              <p className="my-2.5 text-[var(--chat-font-size,0.875rem)] leading-[1.7] text-[var(--text-primary)]">
                {children}
              </p>
            );
          },
          h1({ children }) {
            return (
              <h1 className="mb-2 mt-5 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="mb-2 mt-5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="mb-1.5 mt-4 text-base font-semibold text-[var(--text-primary)]">
                {children}
              </h3>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-2 border-[var(--accent-muted)] bg-[var(--surface-muted)] py-2 pl-4 pr-3 text-[var(--chat-font-size,0.875rem)] italic text-[var(--text-secondary)]">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-5 border-[var(--border)]" />;
          },
          table({ children }) {
            return (
              <div
                className="my-4 max-w-full overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                role="region"
                aria-label="Scrollable table"
                tabIndex={0}
              >
                <table className="w-full min-w-max border-collapse text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[var(--surface-muted)]">{children}</thead>;
          },
          th({ children }) {
            return (
              <th
                scope="col"
                className="px-3 py-2 text-left font-semibold text-[var(--text-primary)]"
              >
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-t border-[var(--border)] px-3 py-2 align-top text-[var(--text-secondary)]">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
