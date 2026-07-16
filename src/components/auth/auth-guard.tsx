"use client";

import { useUser } from "@clerk/nextjs";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthGuardProps {
  /** Content to render when authenticated */
  children: React.ReactNode;
  /** Optional admin role requirement */
  requireAdmin?: boolean;
  /** Optional admin check function that uses Convex */
  isAdmin?: boolean;
  /** Whether the admin check is still loading */
  isAdminLoading?: boolean;
}

/**
 * Guards content behind authentication (and optionally admin role).
 * Shows loading state while checking auth, sign-in prompt if not authenticated,
 * and access denied if not admin.
 */
export function AuthGuard({
  children,
  requireAdmin = false,
  isAdmin,
  isAdminLoading,
}: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  // Still loading auth state
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" label="Checking authentication..." />
      </div>
    );
  }

  // Not signed in - show prompt
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to access this page.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              onClick={() => {
                const redirectUrl = encodeURIComponent(
                  window.location.pathname + window.location.search,
                );
                router.push(`/sign-in?redirect_url=${redirectUrl}`);
              }}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin guard
  if (requireAdmin) {
    if (isAdminLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" label="Verifying access..." />
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <ShieldAlert className="h-12 w-12 text-[var(--destructive)]" />
              </div>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You need admin privileges to access this page. If you believe this is a mistake,
                please contact the site administrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => router.push("/chat")}>
                Go to Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
}
