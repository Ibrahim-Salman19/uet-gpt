# Security

## Auth

- **Provider:** Clerk (Next.js SDK)
- **Session management:** Clerk middleware + Convex auth
- **Webhook verification:** Svix signatures for Clerk events
- **RBAC roles:** user, admin, superadmin

## API Security

- HTTP action CORS restricted to app origin (production)
- Rate limiting via Convex (to be configured)
- Input validation via Convex `v.*` validators

## Data Protection

- No PII logged server-side
- API keys stored as environment variables (never exposed to client)
- Semantic cache entries expire automatically (24h TTL)

## TODO

- [ ] Add rate limiting to HTTP actions
- [ ] Add admin audit logging for sensitive operations
- [ ] Configure CSP headers in next.config.ts
- [ ] Review Clerk webhook secret rotation policy
