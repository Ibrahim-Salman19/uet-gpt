# Design System: Impeccable (Neo Kinpaku)

## Colors

### Brand Anchors
- **Kinpaku Gold**: `oklch(84% 0.19 80.46)` - Primary accent, active status, focused borders.
- **Verdigris Patina**: `oklch(70% 0.12 188)` - Secondary state accent, success, connection indicators.

### Surfaces
- **Lacquer Black**: `oklch(7% 0.006 95)` - Main page ground.
- **Lacquer Deep**: `oklch(4% 0.004 95)` - Deepest inset panels, terminal frames.
- **Raised Lacquer**: `oklch(11% 0.006 95)` - Main panels, input area container.
- **Graphite**: `oklch(15% 0.008 95)` - Inactive elements, secondary controls.

### Text Tiers
- **Champagne**: `oklch(91% 0 0)` - Headers, important markers.
- **Body Warm**: `oklch(88% 0 0)` - Standard reading copy.
- **Muted Text**: `oklch(72% 0 0)` - Secondary labels, timestamps.

### Hairlines
- **Default Hairline**: `oklch(78% 0 0 / 0.16)` - Layout grids, default dividers.
- **Active Gold Hairline**: `oklch(74% 0.09 82 / 0.6)` - Active/focused input borders.

## Typography
- **UI & Body Font**: Geist, Albert Sans, Arial, system-ui, sans-serif
- **Technical & Mono Font**: JetBrains Mono, Fira Code, monospace

## Rounded Borders (Small Radii Only)
- `none`: `0`
- `xs`: `2px` (Buttons, tabs)
- `sm`: `4px` (Inputs, badge containers)
- `md`: `6px` (Panels, primary structural elements)
- `lg`: `8px` (Max radius, only for main shell outer bounds)

## Loading Experience (Pre-Load & Skeletons)
- Skeletons must NOT use thick gray pills or lazy cards.
- Skeletons are replaced by hairline frames with technical monospace text e.g., `INITIALIZING...` and geometric gold hairline pulsing loaders.
