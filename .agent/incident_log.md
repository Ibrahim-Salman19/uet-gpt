# Incident Log

## Incident: 2026-05-30 12:20 UTC
- Trigger: Tests failed during Phase 0 / Phase 1 (129 failed initially, then 218 after git checkout).
- Cause: Untracked files and test configuration issues causing test failures.
- Resolution: Ran `git checkout -- .`. Could not run `git clean -fd` due to permission timeouts.
- Prevention: Ensure tests pass before invoking the cron protocol.

## Incident: 2026-05-30 (archived) CLERK_SIGNING_SECRET Leak (Pre-v15)
- Trigger: Architecture audit §21.20 identified that `WEBHOOK_SECRET` was passed as a mutation arg.
- Cause: Webhook route (`clerk/route.ts`) passed `secret` as a mutation argument to `users:getOrCreate`, making it visible in Convex mutation traces.
- Resolution: Created `convex/clerk/webhook.ts` HTTP action that receives event data via `POST` with `Authorization` header auth. Removed `secret` from all mutation args. Next.js route verifies Svix, then forwards to Convex HTTP action.
- Prevention: All secrets must be transmitted via HTTP headers (not mutation args), and validated server-side via process.env.
