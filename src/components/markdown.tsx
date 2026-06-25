import { Check, Copy } from "lucide-react";
import { useState } from "react";
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

/**
 * Allow only safe URL schemes (plus scheme-relative / relative URLs). Rejects
 * `javascript:`, `data:`, `vbscript:`, etc. so untrusted markdown can never
 * produce an executable link.
 */
function isSafeHref(href: string | undefined): href is string {
  if (!href) return false;
  const trimmed = href.trim();
  // Relative or fragment/query links have no scheme — treat as safe.
  if (/^(#|\/|\.\/|\.\.\/|\?)/.test(trimmed)) return true;
  // No scheme at all (e.g. "example.com/path") — safe.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return true;
  try {
    const scheme = new URL(trimmed, "https://example.invalid").protocol;
    return SAFE_URL_SCHEMES.has(scheme);
  } catch {
    return false;
  }
}

function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(children);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
      {language && (
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto bg-[var(--surface-base)] p-3 md:p-4 text-xs md:text-sm leading-relaxed scrollbar-thin">
          <code>{children}</code>
        </pre>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--semantic-success)]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className: cl, children, ...props }) {
            // Block code is highlighted (`hljs`), carries a `language-` class, or
            // spans multiple lines; anything else is inline. Avoid relying solely
            // on the highlighter class so unknown/plain fenced blocks still render
            // as blocks (delegated to the `pre` renderer below).
            const hasLanguage = /\b(?:hljs|language-\w+)\b/.test(cl ?? "");
            const isMultiline = typeof children === "string" && children.includes("\n");
            const isInline = !hasLanguage && !isMultiline;
            if (isInline) {
              return (
                <code
                  className="rounded-[var(--radius-xs)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[0.9em] font-mono text-[var(--text-primary)]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return null;
          },
          pre({ children }) {
            const child = children as React.ReactElement<{ className?: string; children: string }>;
            const className = child?.props?.className || "";
            // Extract only the `language-xxx` token; ignore other classes such
            // as `hljs` that rehype-highlight adds, so the label stays clean.
            const language = className.match(/language-(\w+)/)?.[1] ?? "";
            const codeContent = String(child?.props?.children || "");
            return <CodeBlock language={language}>{codeContent}</CodeBlock>;
          },
          a({ href, children }) {
            // Defense-in-depth: only allow safe schemes (and relative URLs) so
            // model/RAG-generated `javascript:`/`data:`/`vbscript:` hrefs can
            // never produce an active link, regardless of react-markdown config.
            const safeHref = isSafeHref(href) ? href : undefined;
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-[var(--accent)] underline decoration-[var(--accent-muted)] underline-offset-2 transition-colors hover:decoration-[var(--accent)]"
              >
                {children}
              </a>
            );
          },
          ul({ children }) {
            return <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>;
          },
          li({ children }) {
            return (
              <li className="text-[var(--chat-font-size,0.875rem)] leading-relaxed text-[var(--text-primary)]">
                {children}
              </li>
            );
          },
          p({ children }) {
            return (
              <p className="my-2 text-[var(--chat-font-size,0.875rem)] leading-relaxed text-[var(--text-primary)]">
                {children}
              </p>
            );
          },
          h1({ children }) {
            return (
              <h1 className="mb-2 mt-4 text-lg font-semibold text-[var(--text-primary)]">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="mb-2 mt-3 text-base font-semibold text-[var(--text-primary)]">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="mb-1 mt-3 text-sm font-semibold text-[var(--text-primary)]">
                {children}
              </h3>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-2 border-[var(--accent-muted)] bg-[var(--surface-muted)] py-1 pl-4 text-[var(--chat-font-size,0.875rem)] italic text-[var(--text-secondary)]">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-4 border-[var(--border)]" />;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[var(--surface-muted)]">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-t border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
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
