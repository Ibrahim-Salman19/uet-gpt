import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { uetClerkAppearance } from "@/lib/clerk-theme";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Sign Up - ${APP_NAME}`,
  description: "Create your account and start using UET GPT, your AI guide to UET Taxila.",
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--surface-base)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--accent)]">
            <svg
              className="h-7 w-7 text-[var(--accent-fg)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Logo"
            >
              <title>UET GPT Logo</title>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] text-balance">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Get started with UET GPT</p>
        </div>
        <SignUp appearance={uetClerkAppearance} signInUrl="/sign-in" />
      </div>
    </div>
  );
}
