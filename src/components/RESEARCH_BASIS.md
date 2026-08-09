# Research Basis

The enhancement decisions were checked against current official or primary technical documentation available on 2026-07-31.

| Area | Primary guidance reviewed | Applied decision |
|---|---|---|
| React external stores | React `useSyncExternalStore` reference | Convex connection state is cached as a stable external-store snapshot with one subscription. |
| React effects and Strict Mode | React Hooks and Strict Mode references | Every listener, observer, timer, renderer, recognition instance, and audio context has mirrored cleanup. Module-level Convex client creation avoids an impure state initializer. |
| Next.js Client Components | Next.js App Router Server/Client Component guidance | Interactive components keep client boundaries; the purely presentational loading component remains server-renderable. |
| Next.js lazy loading | Next.js App Router lazy-loading guidance | Three.js remains behind `next/dynamic` and is not loaded for disabled, reduced-motion, or data-saver fallback paths. |
| Clerk and Convex | Current Clerk–Convex integration guidance and Convex React authentication guidance | `ClerkProvider` remains outside `ConvexProviderWithClerk`; Convex-authenticated readiness uses `useConvexAuth`. |
| Convex connection state | ConvexReactClient reference | The unstable connection-state API is isolated in one monitor and only a narrow optional field set is consumed. |
| Modal dialogs | HTML dialog specification/MDN and WAI-ARIA modal dialog pattern | Native `showModal`, inert background behavior, Cancel/close synchronization, backdrop handling, focus containment, and focus restoration are used. |
| Combobox/listbox | WAI-ARIA Authoring Practices combobox pattern | The command palette keeps focus in the input, uses `aria-activedescendant`, supports arrows/Enter/Escape, and does not override normal text-editing keys. |
| Markdown safety | react-markdown security documentation | Raw HTML is disabled; every transformed URL is parsed and constrained to approved protocols; external links and images use hardened attributes. |
| WebGL lifecycle | Three.js WebGLRenderer reference | `setAnimationLoop`, container-aware drawing-buffer sizing, capped DPR, disposal, visibility suspension, and context recovery are used. |
| Reduced motion | Browser media-query guidance | Decorative animation is conservatively disabled until the client preference is known and updates when the OS setting changes. |
| Data saver | Network Information `saveData` documentation | Data saver is feature-detected and treated as an optional constraint, never assumed to exist cross-browser. |
| Speech recognition | Web Speech API documentation | Recognition is feature-detected, starts only through explicit action, distinguishes stop/abort, and releases microphone resources reliably. |
| Browser connectivity | `navigator.onLine` and Network Information guidance | Browser online state is labeled a hint; Convex WebSocket state is the application-specific connection signal. |
