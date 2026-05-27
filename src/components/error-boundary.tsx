"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--destructive)]/10">
            <AlertTriangle className="h-6 w-6 text-[var(--destructive)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Something went wrong</h3>
          <p className="max-w-sm text-xs text-[var(--text-secondary)]">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="mt-2 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
