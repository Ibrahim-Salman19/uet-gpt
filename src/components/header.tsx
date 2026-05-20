"use client";

import { UserButton } from "@clerk/nextjs";
import { GraduationCap, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
  onMenuToggle?: () => void;
}

export function Header({ className, onMenuToggle }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-card)] px-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)]">
            <GraduationCap className="h-4 w-4 text-[var(--primary-fg)]" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              UET GPT
            </h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="ml-1">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 rounded-[var(--radius-sm)]",
                userButtonPopoverCard:
                  "shadow-[var(--shadow-lg)] border border-[var(--border)] rounded-[var(--radius-md)]",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
