import { SignIn } from "@clerk/nextjs";
import { uetClerkAppearance } from "@/lib/clerk-theme";

export default function SignInPage() {
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
            Welcome to UET GPT
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Sign in to your account to continue</p>
        </div>
        <SignIn appearance={uetClerkAppearance} signUpUrl="/sign-up" />
      </div>
    </div>
  );
}
