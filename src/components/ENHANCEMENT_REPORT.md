# UETGPT UI Production Hardening Report

## Scope

This package contains coordinated replacements for all 19 supplied UI components. The work was performed as one architecture-level refactor because these files share provider state, modal state, Convex connectivity, Clerk identity, responsive shell behavior, rendering effects, and accessibility contracts.

The implementation was reviewed against current official guidance for React, Next.js App Router, Convex, Clerk, Three.js, react-markdown, WAI-ARIA Authoring Practices, and browser APIs.

## Architecture contracts preserved

The following existing application contracts are intentionally preserved:

- Existing public component exports remain available.
- Existing routes remain `/chat`, `/explore`, `/settings`, and `/chat/[threadId]`.
- Existing model identifiers remain `llama-3.1-8b` and `llama-4-scout`.
- Existing Convex calls remain:
  - `api.users.getOrCreate({ clerkId, name, email, imageUrl })`
  - `api.users.updatePreferences({ theme, fontSize, model })`
  - `api.threads.create({ title })`
- Existing `useUserData()` assumptions remain:
  - `convexUser`
  - `isConvexLoaded`
  - `modelPreference`
- Existing preference keys and actions remain available. New fields are additive.
- Existing component import paths and named exports were preserved.

## System-level improvements

### State and provider architecture

- Deterministic first render prevents preference-related hydration mismatches.
- Device-local preferences are restored after hydration and synchronized across tabs.
- Server-backed font, accent, and model preferences preserve the existing Convex mutation shape.
- Model selection is optimistic and rolls back if persistence fails.
- Opening settings, voice input, or the command palette closes competing overlays.
- Audio is created only after user interaction and is disposed on provider teardown.
- Default sound behavior is now privacy- and accessibility-conscious: UI and typing sounds start disabled.
- Clerk profile synchronization now detects changes to name, email, and image, serializes writes, retries failures, and avoids stale concurrent updates.
- The Convex client is a module singleton rather than a Strict Mode-sensitive state initializer.

### Responsive shell and navigation

- Desktop and mobile sidebar preferences are independent.
- Resizing no longer overrides a deliberate desktop sidebar choice.
- The mobile drawer uses inert hidden content, focus containment, body scroll locking, and trigger-focus restoration.
- Hidden mobile navigation is removed from keyboard interaction.
- Safe-area insets are respected on mobile devices.
- The model selector supports complete radio-menu keyboard movement and async submission locking.
- Escape closes only the topmost transient surface.
- Native share is used where supported, with clipboard fallback.
- Text-entry detection excludes buttons, checkboxes, radio controls, ranges, files, and other non-text inputs.

### Dialogs and command palette

- Native modal dialogs are opened and closed defensively.
- Backdrop click, Cancel/Escape, close events, focus behavior, and state synchronization agree.
- The command palette follows an editable combobox/listbox model using `aria-activedescendant`.
- Browser-standard text-editing keys are not intercepted.
- Search is normalized, deferred, scored, and alias-aware.
- Duplicate command execution is blocked before React state has time to rerender.
- Thread creation failures surface a user-visible error instead of failing silently.

### Markdown and untrusted generated content

- Raw HTML is disabled.
- URL handling allows only approved schemes and relative URLs.
- External links receive safe relationship attributes.
- Highlighted code can be copied even when syntax highlighting creates nested spans.
- Copy timers are cleaned up on unmount.
- Images are lazy-loaded, asynchronously decoded, and use a no-referrer policy.
- Wide tables are keyboard-scrollable and announced as regions.
- Code, tables, headings, blockquotes, and prose retain the existing visual variable system.

### WebGL and ambient effects

- The WebGL module remains dynamically loaded and is omitted when the preference is disabled.
- Reduced-motion and data-saver users receive a static fallback.
- Particle movement executes in the vertex shader rather than mutating CPU buffers every frame.
- Device-class particle count, DPR, and FPS are capped.
- Quality degrades and recovers using smoothed frame and renderer-submission measurements.
- Animation stops in hidden pages and resumes without large time jumps.
- Resize, DPR changes, context loss, context restoration, and render failure are handled.
- GPU resources, observers, listeners, and animation loops are disposed symmetrically.
- Devices without usable WebGL continue running the application with a static background.
- Ambient glow uses compositor transforms rather than reconstructing a gradient on every pointer event.

### Voice input

- The microphone starts only after an explicit user action.
- Recognition support is feature-detected, including the vendor-prefixed implementation.
- Interim and final results are accumulated safely.
- Stop and abort paths have distinct semantics.
- Recognition is capped to prevent an indefinitely open microphone.
- All recognition handlers and timers are released during close and unmount.
- Permission, no-speech, network, and unsupported-browser errors are expressed clearly.
- A disclosure explains that browser speech recognition may use a browser or platform service.

### Connectivity and diagnostics

- All fabricated telemetry was removed.
- The diagnostics panel reports only observable data:
  - animation-frame opportunity
  - actual WebGL state and particle/quality/DPR metadata
  - Convex connection state
  - browser online hint
  - Network Information values when exposed
  - JavaScript heap values only where the browser exposes them
- Unsupported metrics are labeled unavailable rather than invented.
- Convex connection state is consumed through one deduplicated Convex subscription, a cached React external-store snapshot, and a compatibility DOM event for non-hook observers.
- Browser `navigator.onLine` is treated as a hint, not proof of backend reachability.
- Browser recovery triggers a fresh Convex snapshot; reconnection is announced only after that current snapshot reports the socket restored.
- The ready gate no longer recommends disabling IPv6 or claims a server is healthy without evidence.
- Timeout diagnostics distinguish Clerk load, Convex authentication, Convex socket state, and the Convex user query.

## Per-file summary

- `ConvexConnectionMonitor.tsx`: one deduplicated Convex subscription shared through `useSyncExternalStore`, a compatibility event, and a DOM status dataset.
- `ambient-glow.tsx`: transform-based, rAF-coalesced, motion/data/pointer-aware glow.
- `backdrop-wrapper.tsx`: preference-aware dynamic import and static error fallback.
- `command-palette.tsx`: accessible combobox/listbox interaction, ranked search, guarded async actions.
- `connection-status.tsx`: evidence-based offline/reconnect/restored states.
- `convex-ready-gate.tsx`: architecture-aware readiness and honest diagnostics.
- `diagnostics-panel.tsx`: real observable telemetry only.
- `empty-state.tsx`: semantic section, stable IDs, accessible suggestion relationship.
- `loading-state.tsx`: server-renderable skeletons with accessible status regions.
- `main-shell.tsx`: responsive state isolation, focus management, inert behavior, native sharing.
- `markdown.tsx`: hardened URL policy, HTML disabled, robust code copying and table access.
- `preferences-modal.tsx`: accessible switches and radio groups, font controls, hydration state.
- `preferences-provider.tsx`: deterministic hydration, cross-tab sync, server sync, safe audio, overlay exclusivity.
- `providers.tsx`: validated configuration, correct provider order, singleton Convex client, robust Clerk profile sync.
- `theme-provider.tsx`: pre-hydration theme bootstrap, CSP nonce support, system and cross-tab sync.
- `theme-toggle.tsx`: clearer accessible state and decorative-icon semantics.
- `voice-modal-wrapper.tsx`: stable minimal bridge to active chat input.
- `voice-modal.tsx`: explicit-start, bounded, race-safe speech recognition.
- `webgl-backdrop.tsx`: GPU-driven particles, adaptive quality, complete lifecycle handling.

## Deliberate behavior changes

- UI sounds and typing sounds default to disabled.
- Voice recognition does not start automatically when the dialog opens.
- The diagnostics panel does not display token counts, model throughput, ping, memory, or FPS unless those values are genuinely observable in the browser.
- Connection recovery is announced only when Convex reports an actual restored socket.
- Reduced-motion and data-saver preferences suppress decorative GPU animation.
- The previous speculative network-fix instructions were removed.

## Remaining repository-level verification

The supplied materials did not include the full repository, package manifest, lockfile, generated Convex types, backend mutations, `useUserData()` implementation, global CSS, or test configuration. Therefore, this package cannot honestly claim a guaranteed clean repository build by itself.

Run the commands in `MIGRATION_CHECKLIST.md` after applying the files to a branch.
