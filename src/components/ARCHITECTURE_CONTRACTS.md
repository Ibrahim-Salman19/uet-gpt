# Architecture Compatibility Contracts

## Verified from the supplied UI files

### Provider hierarchy

The enhanced `Providers` component maintains the required hierarchy:

```tsx
<ClerkProvider>
  <ThemeProvider>
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      <PreferencesProvider>
        <UserSync />
        <ConvexConnectionMonitor />
        {children}
      </PreferencesProvider>
    </ConvexProviderWithClerk>
  </ThemeProvider>
</ClerkProvider>
```

Clerk remains outside the Convex-Clerk bridge, and preferences remain inside Convex so the provider can use Convex queries and mutations.

### Convex API contracts

No backend endpoint was renamed. The UI calls:

```ts
api.users.getOrCreate({ clerkId, name, email, imageUrl })
api.users.updatePreferences({ theme, fontSize, model })
api.threads.create({ title: "New Chat" })
```

### User-data hook contract

The enhanced components continue to expect:

```ts
const {
  convexUser,
  isConvexLoaded,
  modelPreference,
} = useUserData();
```

`convexUser.preferences.theme` and `convexUser.preferences.fontSize` remain optional server preference sources.

### Model contract

The exact existing backend model keys are preserved:

```ts
"llama-3.1-8b"
"llama-4-scout"
```

UI labels remain `UET-Fast` and `UET-Pro` without changing the values transmitted to Convex or the RAG layer.

### Routing contract

The enhanced UI preserves:

- `/chat`
- `/chat/[threadId]`
- `/explore`
- `/settings`

### Preference context compatibility

All original fields and functions remain available. These additions are non-breaking:

```ts
preferencesHydrated: boolean
setFontSize(size)
```

New exported types and hooks are also additive:

```ts
FontSize
ModelPreference
ToggleSettingKey
useConvexConnectionSnapshot
```

### Named export contract

Static export comparison found no removed original named export in any of the 19 files.

## Required external compatibility

The repository should provide versions supporting the APIs already used by the supplied architecture:

- React with `useSyncExternalStore` and `useDeferredValue`
- Next.js App Router and `next/dynamic`
- Convex React client with `connectionState()` and `subscribeToConnectionState()`
- Clerk Next.js with `ClerkProvider`, `useAuth`, and `useUser`
- `convex/react-clerk` with `ConvexProviderWithClerk`
- Three.js with `outputColorSpace`, `setDrawingBufferSize`, `setAnimationLoop`, and the `colorspace_fragment` shader chunk
- react-markdown with `urlTransform`, `skipHtml`, and component overrides
- react-error-boundary
- sonner
- lucide-react

## Mounting rules

- Mount `ConvexConnectionMonitor` once, preferably in `Providers` as supplied. Diagnostics, banners, and the ready gate then share its cached snapshot instead of opening independent Convex subscriptions.
- Do not mount `ConnectionStatus` and `ConvexReconnectBanner` together unless two banners are explicitly desired.
- Mount `BackdropWrapper`, not `WebGLBackdrop`, in normal application composition so Three.js remains lazy-loaded.
- Mount `VoiceModalWrapper` once near the application shell; the active chat input should register its callback through `setVoiceTranscriptCallback`.
- Keep modal components under `PreferencesProvider`.

## CSS contracts

The enhanced files retain the existing CSS custom-property vocabulary and expect the application styles to define the variables and keyframes already referenced by the original UI, including:

- surface, text, border, radius, shadow, accent, and `--ks-*` variables
- `animate-progress`
- `custom-scroll`
- `scrollbar-thin`
- `glass-nav`
- `mobile-bottom-nav`
- `reduce-micro-animations`

The WebGL component optionally reads:

```css
--webgl-backdrop-opacity
```

When absent, it uses a safe internal fallback.
