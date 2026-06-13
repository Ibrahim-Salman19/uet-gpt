"use client";

import { Bookmark, Check, Copy, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/preferences-provider";
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

function handleCopyAction(content: string, setCopied: (v: boolean) => void) {
  return async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
}

function handlePinAction(
  content: string,
  pinned: boolean,
  pinnedHighlights: { id: string; query: string; content: string }[],
  addPin: (query: string, highlight: string) => void,
  removePin: (id: string) => void,
) {
  return () => {
    if (pinned) {
      const pin = pinnedHighlights.find(
        (p) => p.content.toLowerCase().trim() === content.toLowerCase().trim(),
      );
      if (pin) removePin(pin.id);
    } else {
      addPin(content.slice(0, 40) + (content.length > 40 ? "..." : ""), content);
    }
  };
}

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCopy}
          className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label={copied ? "Copied" : "Copy message"}
          data-touch-target="true"
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
  );
}

function PinButton({ pinned, onPin }: { pinned: boolean; onPin: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPin}
          className={cn(
            "h-7 w-7",
            pinned
              ? "text-[var(--accent)] hover:text-[var(--accent-hover)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
          )}
          aria-label={pinned ? "Unpin message" : "Pin message"}
          data-touch-target="true"
        >
          <Bookmark className={cn("h-3.5 w-3.5", pinned && "fill-current")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{pinned ? "Unpin" : "Pin message"}</TooltipContent>
    </Tooltip>
  );
}

function EditButton({ onEdit }: { onEdit?: () => void }) {
  if (!onEdit) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Edit message"
          data-touch-target="true"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Edit</TooltipContent>
    </Tooltip>
  );
}

function DeleteButton({ onDelete }: { onDelete?: () => void }) {
  if (!onDelete) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--destructive)]"
          aria-label="Delete message"
          data-touch-target="true"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Delete</TooltipContent>
    </Tooltip>
  );
}

function FeedbackButtons({
  feedback,
  onFeedback,
  onFeedbackChange,
}: {
  feedback: "thumbsUp" | "thumbsDown" | null;
  onFeedback?: (rating: "thumbsUp" | "thumbsDown") => void;
  onFeedbackChange: (value: "thumbsUp" | "thumbsDown" | null) => void;
}) {
  if (!onFeedback) return null;
  return (
    <div className="ml-1 flex items-center gap-0.5 border-l border-[var(--border)] pl-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const next = feedback === "thumbsUp" ? null : "thumbsUp";
              onFeedbackChange(next);
              if (next) onFeedback(next);
            }}
            className={cn(
              "h-7 w-7",
              feedback === "thumbsUp"
                ? "text-[var(--semantic-success)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
            aria-label={feedback === "thumbsUp" ? "Remove helpful" : "Mark as helpful"}
            data-touch-target="true"
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
              onFeedbackChange(next);
              if (next) onFeedback(next);
            }}
            className={cn(
              "h-7 w-7",
              feedback === "thumbsDown"
                ? "text-[var(--destructive)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
            aria-label={feedback === "thumbsDown" ? "Remove not helpful" : "Mark as not helpful"}
            data-touch-target="true"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Not helpful</TooltipContent>
      </Tooltip>
    </div>
  );
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

  const { addPin, removePin, isPinned, pinnedHighlights } = usePreferences();
  const pinned = isPinned(content);

  const handleCopy = handleCopyAction(content, setCopied);
  const handlePin = handlePinAction(content, pinned, pinnedHighlights, addPin, removePin);

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 transition-opacity duration-[var(--duration-normal)]",
        show ? "opacity-100" : "opacity-75 lg:opacity-0 lg:group-hover:opacity-100",
        className,
      )}
    >
      <CopyButton copied={copied} onCopy={handleCopy} />
      <PinButton pinned={pinned} onPin={handlePin} />

      {role === "user" && <EditButton onEdit={onEdit} />}

      <DeleteButton onDelete={onDelete} />

      {role === "assistant" && (
        <FeedbackButtons
          feedback={feedback}
          onFeedback={onFeedback}
          onFeedbackChange={setFeedback}
        />
      )}
    </div>
  );
}
