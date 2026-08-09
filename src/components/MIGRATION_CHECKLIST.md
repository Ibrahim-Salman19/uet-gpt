# Migration and End-to-End Verification Checklist

## 1. Apply safely

1. Create a dedicated branch.
2. Back up the current component directory.
3. Copy the 19 TSX files into the matching `@/components` paths.
4. Review any local modifications that were not part of the supplied files.

## 2. Validate generated backend types

```bash
npx convex codegen
```

Confirm these calls type-check without casts or backend changes:

```ts
api.users.getOrCreate
api.users.updatePreferences
api.threads.create
```

## 3. Run repository checks

Use the package manager already selected by the lockfile:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

Replace `pnpm` with `npm`, `yarn`, or `bun` only when that is the repository's established package manager.

## 4. Verify authentication and user synchronization

- Sign in with a new Clerk account.
- Confirm exactly one Convex user record is created.
- Change the Clerk name or profile image and confirm the Convex user record updates.
- Disconnect during synchronization and confirm retries do not create duplicate records.
- Sign out and sign in as a different user; confirm no state leaks between identities.

## 5. Verify RAG/model synchronization

- Select `UET-Fast` and inspect the persisted model value: `llama-3.1-8b`.
- Select `UET-Pro` and inspect the persisted model value: `llama-4-scout`.
- Confirm the chat/RAG request reads the same user preference source.
- Simulate a failed `updatePreferences` mutation and confirm the selector rolls back.
- Reload and confirm the server-selected model is restored.

## 6. Verify preferences

- Change accent and font size; reload and confirm persistence.
- Open a second tab and confirm device-local settings synchronize.
- Confirm server-backed accent/font values win during signed-in initialization.
- Reset defaults and confirm the server receives theme, font size, and model.
- Confirm WebGL, glow, motion, and sound settings remain device-local as intended.

## 7. Verify dialogs and keyboard operation

- Open the command palette with Ctrl/Command+K.
- Navigate commands with Arrow Up/Down and run with Enter.
- Verify normal text cursor, selection, and editing shortcuts still work.
- Press Escape and confirm only the topmost menu/dialog closes.
- Open settings, then voice input, then the palette; verify only one modal remains open.
- Navigate accent and font radio groups with arrow keys, Home, and End.
- Confirm focus returns to the invoking control after closing a modal or mobile drawer.

## 8. Verify responsive shell

- Toggle the desktop sidebar, resize below and above 1024px, and confirm the desktop choice is retained.
- Open the mobile drawer and verify background controls cannot be focused.
- Verify the page does not scroll beneath the mobile drawer.
- Focus the chat textarea and confirm bottom navigation does not cover the virtual keyboard/input.
- Test iOS/Android safe-area insets.

## 9. Verify Markdown safety and rendering

Test model output containing:

- headings and paragraphs
- inline and fenced code
- an unknown fenced language
- nested syntax-highlight spans
- GFM tables, task lists, and strikethrough
- long unbroken text
- relative links and HTTPS links
- `javascript:`, `data:`, and malformed URLs
- raw HTML
- images

Confirm executable URLs and raw HTML do not become active content.

## 10. Verify voice input

- Confirm opening the dialog does not immediately activate the microphone.
- Start explicitly and accept/deny microphone permission.
- Test interim and final recognition results.
- Stop and confirm captured speech is retained.
- Cancel and confirm the microphone is aborted and transcript cleared.
- Leave recognition open and confirm the safety timeout stops it.
- Test an unsupported browser.

## 11. Verify WebGL/fallback behavior

- Enable WebGL on desktop and mobile.
- Disable WebGL and confirm Three.js is not loaded by `BackdropWrapper`.
- Enable reduced motion and confirm a static fallback.
- Enable browser data saver where supported and confirm a static fallback.
- Test hardware acceleration disabled or a software-only renderer.
- Background and restore the tab.
- Resize, zoom, and move between displays with different DPR.
- Trigger WebGL context loss/restoration in browser developer tools if available.
- Confirm no increasing canvas, listener, animation-loop, or GPU-resource count after repeated toggles.

## 12. Verify connectivity states

- Start offline.
- Lose browser connectivity after a successful session.
- Restore browser connectivity while Convex is still reconnecting.
- Confirm “restored” appears only after Convex reconnects.
- Confirm the ready gate identifies which layer is waiting: Clerk, Convex auth, socket, or user query.
- Confirm diagnostics never displays invented values.

## 13. Recommended automated tests

Add or update:

- provider contract tests
- preference hydration and storage-event tests
- model optimistic-update rollback tests
- Clerk-to-Convex profile synchronization tests
- command palette keyboard tests
- dialog focus restoration tests
- Markdown malicious-link fixtures
- WebGL disabled/reduced-motion/data-saver fallback tests
- Convex connection-state deduplication tests
- Playwright mobile drawer and virtual-keyboard viewport tests
