"use client";

import { Check, Copy, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant";
  onEdit?: () => void;
  onDelete?: () => void;
  onFeedback?: (rating: "thumbsUp" | "thumbsDown") => void;
  className?: string;
  show?: boolean;
}

export function MessageActions({
  content,
  role,
  onEdit,
  onDelete,
  onFeedback,
  className,
  show,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"thumbsUp" | "thumbsDown" | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 transition-opacity duration-[var(--duration-fast)]",
        show ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--semantic-success)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copy</TooltipContent>
      </Tooltip>

      {role === "user" && onEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Edit</TooltipContent>
        </Tooltip>
      )}

      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--destructive)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Delete</TooltipContent>
        </Tooltip>
      )}

      {role === "assistant" && onFeedback && (
        <div className="ml-1 flex items-center gap-0.5 border-l border-[var(--border)] pl-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const next = feedback === "thumbsUp" ? null : "thumbsUp";
                  setFeedback(next);
                  if (next) onFeedback(next);
                }}
                className={cn(
                  "h-7 w-7",
                  feedback === "thumbsUp"
                    ? "text-[var(--semantic-success)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Helpful</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const next = feedback === "thumbsDown" ? null : "thumbsDown";
                  setFeedback(next);
                  if (next) onFeedback(next);
                }}
                className={cn(
                  "h-7 w-7",
                  feedback === "thumbsDown"
                    ? "text-[var(--destructive)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Not helpful</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
