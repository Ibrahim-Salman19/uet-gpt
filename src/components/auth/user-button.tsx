"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * User button with avatar and dropdown menu.
 * Shows the current user's avatar, name, and navigation options.
 * Falls back to a skeleton while loading.
 */
export function UserButton() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1 flex-1 hidden sm:block">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 w-28" />
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) return null;

  const initials = user.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) ?? ""}`
    : (user.emailAddresses?.[0]?.emailAddress?.charAt(0).toUpperCase() ?? "?");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 w-full hover:bg-[var(--surface-hover)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.imageUrl} alt={user.fullName ?? "User"} />
            <AvatarFallback className="text-xs font-medium bg-[var(--accent)] text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left hidden sm:block min-w-0">
            <p className="text-sm font-medium truncate text-[var(--text)]">
              {user.fullName ?? "User"}
            </p>
            <p className="text-xs truncate text-[var(--text-muted)]">
              {user.primaryEmailAddress?.emailAddress ?? ""}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" side="top">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate">{user.fullName ?? "User"}</span>
            <span className="text-xs font-normal text-[var(--text-muted)] truncate">
              {user.primaryEmailAddress?.emailAddress ?? ""}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="cursor-pointer text-red-500 focus:text-red-500"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
