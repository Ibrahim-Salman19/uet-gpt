"use client";

import { Crown, Search, Shield, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeUserRole, searchUsers, setUserRole, type UserResult } from "./actions";

const ROLE_BADGES: Record<
  "user" | "admin" | "superadmin",
  { label: string; className: string; icon: React.ReactNode }
> = {
  user: {
    label: "User",
    className: "text-zinc-400 bg-zinc-900/60 border-white/5",
    icon: <Shield className="h-3 w-3" />,
  },
  admin: {
    label: "Admin",
    className: "text-amber-400 bg-amber-500/5 border-amber-500/10",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  superadmin: {
    label: "Superadmin",
    className: "text-red-400 bg-red-500/5 border-red-500/10",
    icon: <Crown className="h-3 w-3" />,
  },
};

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) {
      toast.error("Search query must be at least 2 characters");
      return;
    }
    setLoading(true);
    setSearched(true);
    const result = await searchUsers(query);
    if (result.error) {
      toast.error(result.error);
      setUsers([]);
    } else {
      setUsers(result.users);
    }
    setLoading(false);
  }, [query]);

  const handleSetRole = useCallback(async (userId: string, role: string) => {
    setUpdatingId(userId);
    const result = await setUserRole(userId, role);
    if (result.success) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success(`Role updated to ${role}`);
    } else {
      toast.error(result.error ?? "Failed to update role");
    }
    setUpdatingId(null);
  }, []);

  const handleRemoveRole = useCallback(async (userId: string) => {
    setUpdatingId(userId);
    const result = await removeUserRole(userId);
    if (result.success) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: "user" } : u)));
      toast.success("Role removed — user downgraded to regular user");
    } else {
      toast.error(result.error ?? "Failed to remove role");
    }
    setUpdatingId(null);
  }, []);

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      {/* Header */}
      <div className="pb-2 border-b border-white/[0.04]">
        <h2 className="text-sm font-semibold text-zinc-400 font-mono tracking-tight uppercase">
          [ CONTROL_PANEL: USER MANAGEMENT ]
        </h2>
        <p className="text-xs text-zinc-500 font-sans mt-0.5">
          Search users and manage admin roles via Clerk Backend API
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !loading && query.trim().length >= 2 && handleSearch()
            }
            className="h-9 pl-9 bg-black/40 border-white/5 text-xs font-mono rounded text-zinc-300 focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={loading || query.trim().length < 2}
          className="h-9 bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] font-mono text-xs font-semibold tracking-wider transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <span className="animate-pulse">SEARCHING...</span>
          ) : (
            <>
              <Search className="h-3.5 w-3.5 mr-2" />
              SEARCH
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {!searched && (
        <div className="text-center py-16 text-zinc-500 text-xs font-sans">
          Enter a search query to find users
        </div>
      )}

      {searched && users.length === 0 && !loading && (
        <div className="text-center py-16 text-zinc-500 text-xs font-sans">
          No users found matching &ldquo;{query}&rdquo;
        </div>
      )}

      {users.length > 0 && (
        <div className="border border-white/5 rounded-xl bg-[var(--surface-3)]/40 backdrop-blur-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-6 py-3 border-b border-white/5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
            <span>User</span>
            <span>Email</span>
            <span>Role</span>
            <span>Actions</span>
          </div>

          {/* User Rows */}
          <div className="divide-y divide-white/[0.03]">
            {users.map((user) => {
              const roleKey = user.role as keyof typeof ROLE_BADGES;
              const badge = ROLE_BADGES[roleKey] ?? ROLE_BADGES.user;
              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt=""
                        className="h-7 w-7 rounded-full border border-white/10"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] text-zinc-400 font-mono">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-zinc-200 font-sans truncate">
                      {user.name || "Unknown"}
                    </span>
                  </div>

                  {/* Email */}
                  <span className="text-[11px] text-zinc-500 font-mono truncate">{user.email}</span>

                  {/* Role Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-[9px] font-mono py-1 px-2.5 rounded border ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label.toUpperCase()}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {user.role !== "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId === user.id}
                        onClick={() => handleSetRole(user.id, "admin")}
                        className="h-7 text-[9px] font-mono border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-all active:scale-[0.97]"
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        MAKE ADMIN
                      </Button>
                    )}
                    {user.role !== "superadmin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId === user.id}
                        onClick={() => handleSetRole(user.id, "superadmin")}
                        className="h-7 text-[9px] font-mono border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-[0.97]"
                      >
                        <Crown className="h-3 w-3 mr-1" />
                        SUPER
                      </Button>
                    )}
                    {user.role !== "user" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId === user.id}
                        onClick={() => handleRemoveRole(user.id)}
                        className="h-7 text-[9px] font-mono border-white/10 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-all active:scale-[0.97]"
                      >
                        <ShieldOff className="h-3 w-3 mr-1" />
                        REMOVE
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
