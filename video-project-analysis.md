# Video-Project Repository: Comprehensive Analysis Report

**Repository**: `devhms/video-project` (fork of `hafizmuhammadibrahimsalman-create/video-project`)  
**Purpose**: Cinematic Remotion video for **Islami Jamiat-e-Talaba Pakistan (IJT)** — Pakistan's largest student organization  
**Framework**: Remotion v4.0.411 (programmatic video in React)  
**Duration**: ~159 seconds (~2.65 min) at 60fps, 13 sequenced scenes  
**Resolutions**: 1080p (1920×1080) and 4K (3840×2160)  
**Last built**: macOS-style bundle (build/ directory exists with all chunks)

---

## 1. Architecture: Remotion Project Structure & Composition Setup

### Entry Points
```
src/index.ts                     → registerRoot(RemotionRoot)
src/Root.tsx                     → 4 registered compositions
src/Composition.tsx              → Legacy stub (unused, returns null)
```

### 4 Compositions (registered in Root.tsx)

| Composition ID | Resolution | FPS | Duration | Component |
|---|---|---|---|---|
| `IJT-Introduction` | 1920×1080 | 60 | 159s (9540 frames) | `IJTVideo` |
| `Demo-Enhancement-System` | 1920×1080 | 60 | 10s (600 frames) | `DemoScene` |
| `IJT-Cinematic-Master` | **3840×2160** | 60 | 159s (9540 frames) | `CinematicIJT` |
| `Urdu-Test` | 1920×1080 | 60 | 5s (300 frames) | `UrduTest` |

### Composition Hierarchy
- **`IJTVideo`** — Streamlined version: bare sequences + global `Captions` + `AudioMixer`
- **`CinematicIJT`** — Full cinematic master: wraps everything in `ColorGrade("cinematic")`, adds `FilmGrain`, intro `ParticleField` + `CrescentMoon` overlay (first 5s), then 13 scene `Sequence` components, `Captions`, `AudioMixer`
- **`DemoScene`** — Standalone tech demo showcasing Camera system, ColorGrade, FilmGrain, ParticleField, CrescentMoon icon
- **`UrduTest`** — Simple Urdu rendering test with typewriter, fade-in, and slide-up animations

### Scene Orchestration
- Scenes are sequenced via Remotion `<Sequence>` components with `from` and `durationInFrames` props
- All timing in `src/config/sceneTimings.ts` — defines `SCENES` map with `{ start, duration, fps }` in seconds, converted to frames via `toFrames()`

---

## 2. Scene Breakdown: All 14+ Scenes

### Scene 0: Intro Particles (0–5s, overlapping)
- Implemented inside `CinematicIJT.tsx` (not a separate scene file)
- `ParticleField` (80 particles) + translucent `CrescentMoon` overlay
- Not present in `IJTVideo.tsx`

### Scene 1: OpeningTitle (0–8s)
- **File**: `src/scenes/OpeningTitle.tsx`
- **Content**: IJT branding reveal
  - Bouncy logo entry (spring animation) with glow ring
  - Urdu title: "اسلامی جمعیت طلبہ پاکستان" (blur reveal)
  - English title: "Islami Jamiat-e-Talaba Pakistan" (slideUp)
  - Tagline: "Pakistan's Largest Student Organization" (scaleIn)
  - Background: Multi-layer radial gradients + rotation
  - `ParticleField` (150 particles, sphere formation, green-teal hues)
  - `ColorGrade: teal-orange` with strong vignette (0.5)

### Scene 2: HistoricalFoundation (8–28s, 20s)
- **File**: `src/scenes/HistoricalFoundation.tsx`
- **Content**: Founding story
  - Pakistan map emoji (🇵🇰) with glassmorphism card
  - Lahore location pin with bounce animation
  - Founding year "1947" with "23rd December" detail
  - Description: "Founded by 25 dedicated students in Lahore"
  - Animated border gradient rotating around map card
  - Floating particle trail
  - `ColorGrade: cinematic`

### Scene 3: MissionPurpose (28–48s, 20s)
- **File**: `src/scenes/MissionPurpose.tsx`
- **Content**: Mission statement + 5 pillars
  - Title: "Our Mission"
  - Mission quote about seeking pleasure of Allah SWT through human capital development
  - **5 Pillar Cards**: Empowering Youth, Building Leadership, Developing Skills, Fighting for Rights, Just Society
  - Each card: lucide-react icon, English title, Urdu title, description, color-coded
  - Spring entry per card (staggered), 3D rotateY entry, float animation
  - Background: Animated floating vertical lines
  - `ColorGrade: teal-orange`

### Scene 4: IdeologicalFoundations (48–63s, 15s)
- **File**: `src/scenes/IdeologicalFoundations.tsx`
- **Content**: Three key thinkers
  - **Allama Muhammad Iqbal** — Quote: "خودی کو کر بلند اتنا"
  - **Syed Abul A'la Maududi** — Quote: "اقامت دین کا مشن"
  - **Hasan al-Banna** — Quote: "اسلام ایک مکمل نظام حیات"
  - Active card highlighting (cycles through thinkers based on frame)
  - Portrait placeholder circles, Urdu quotes
  - Dynamic background: radial gradient matching active thinker's color
  - Floating ❝ quote marks as background decoration
  - Wrapped in `CinematicWrapper` (preset: cinematic)

### Scene 5: GrowthTimeline (63–78s, 15s)
- **File**: `src/scenes/GrowthTimeline.tsx`
- **Content**: Historical timeline
  - **4 Eras**: Foundation (1947-1960), Expansion (1960-1980), Consolidation (1980-2000), Modern (2000-Present)
  - Interactive progress bar per card
  - Connector lines between eras that light up as timeline progresses
  - Dynamic background matching active era color
  - Wrapped in `CinematicWrapper` (preset: teal-orange)

### Scene 6: OrganizationalStructure (78–88s, 10s)
- **File**: `src/scenes/OrganizationalStructure.tsx`
- **Content**: Leadership hierarchy
  - **Central Leadership** (top row): Hassan Bilal Hashmi (Central President) + Sahibzada Waseem Haider (Secretary General)
  - With emoji avatars (👑, 🤝), qualifications, roles
  - **Provincial Presidents** (grid): 6 presidents (Punjab South/North, KPK, Balochistan, AJK&GB, Sindh)
  - Fade-in grid with MapPin icons
  - Data from `src/data/leadership.ts` (includes 40+ past presidents dating to 1947)
  - Wrapped in `CinematicWrapper` (preset: teal-orange)

### Scene 7: ActivitiesInitiatives (88–103s, 15s)
- **File**: `src/scenes/ActivitiesInitiatives.tsx`
- **Content**: 4 activity categories in 2×2 grid
  - **Study Circles** (BookOpen icon) — Weekly Islamic education
  - **Welfare Programs** (Heart icon) — Community service
  - **Dawah Campaigns** (Megaphone icon) — Spreading the message
  - **Leadership Training** (Users icon) — Building future leaders
  - Staggered spring entry, icon rotation, float animation
  - Wrapped in `CinematicWrapper` (preset: teal-orange)

### Scene 8: SubOrganizations / Departments (103–113s, 10s)
- **File**: `src/scenes/SubOrganizations.tsx`
- **Content**: 17 departments in scrolling 3D grid
  - **3-column grid** with perspective transform (rotateX 20°)
  - **Auto-scroll**: content scrolls upward revealing all departments
  - **Bottom fade gradient** to mask scroll boundary
  - Departments include: Archives, Bait-ul-Mal, CERAPA, Data, Organization, Foreign Affairs, HRD, IT, ISCH, Mass Media, Admin, Print & Electronic Media, PR, Publications, Social Media, SAFE, SAMA
  - Each with description and role
  - Data from `src/data/departments.ts`
  - Wrapped in `CinematicWrapper` (preset: cinematic)

### Scene 9: GlobalConnections (113–121s, 8s)
- **File**: `src/scenes/GlobalConnections.tsx`
- **Content**: International network visualization
  - **Central globe** (🌍 emoji) with glow and spring entry
  - **6 connection nodes**: WAMY (Global), IIFSO (International), Muslim Youth (Europe), ISNA (Americas), MSA (USA/Canada), FOSIS (UK)
  - Radiating connection lines with opacity animation
  - Star field background (50 randomly placed twinkling dots)
  - Globe rotation via `continuousRotation`
  - Wrapped in `CinematicWrapper` (preset: cinematic)

### Scene 10: CoreValues (121–131s, 10s)
- **File**: `src/scenes/CoreValues.tsx`
- **Content**: 6 values orbiting a center point
  - **Center**: "لا الہ الا اللہ محمد رسول اللہ" (Kalma) in circular gradient container with pulse
  - **6 orbiting values**: Faith (ایمان), Knowledge (علم), Justice (عدل), Brotherhood (اخوت), Struggle (جہاد), Piety (تقویٰ)
  - Orbit radius: 320px, with color-coded glassmorphism cards
  - Rotating light beams as background decoration
  - Spring entry per value (staggered)
  - Wrapped in `CinematicWrapper` (preset: cinematic)

### Scene 11: ImpactVisualization (131–141s, 10s)
- **File**: `src/scenes/ImpactVisualization.tsx`
- **Content**: Two-part data visualization (transitions halfway through)
  - **Part A — Growth Chart** (first ~2s): `GrowthChart` component (Chart.js line chart)
    - Membership growth from 25 (1947) to 500K (2024)
    - Progressive data reveal with animation
    - Styled with theme colors
  - **Part B — Pakistan Map** (remaining ~3s): `PakistanMap` component (D3)
    - Province-level density visualization using `pakistan.geo.json`
    - Mercator projection centered on Pakistan (69°E, 30°N)
    - Color scale: `d3.interpolateGreens` for IJT Impact Density
    - Province name labels, legend
    - Staggered province reveal animation
  - Crossfade transition between chart and map
  - Also has: `ImpactStats.tsx` scene (built but not sequenced in main timeline — 6 stat cards with animated counters)
  - Wrapped in `CinematicWrapper` (preset: teal-orange)

### Scene 12: FutureVision (141–149s, 8s)
- **File**: `src/scenes/FutureVision.tsx`
- **Content**: Forward-looking vision
  - **4 Vision Cards**: Innovation (جدت), Excellence (فضیلت), Global Impact (عالمی اثر), Transformation (تبدیلی)
  - Each with lucide-react icon (Rocket, Target, Globe, Sparkles)
  - Pulsing radial background, rising particle effect
  - Urdu subtitle: "مستقبل کا وژن"
  - Bottom CTA: "ہم لائیں گے اسلامی انقلاب ان شاء اللہ"
  - Wrapped in `CinematicWrapper` (preset: teal-orange)

### Scene 13: ClosingOutro (149–159s, 10s)
- **File**: `src/scenes/ClosingOutro.tsx`
- **Content**: Credits and closing
  - **Scrolling credits**: Production Team (Concept & Direction, Animation & Design, Technical Development)
  - **Final logo reveal**: Crescent moon in gradient circle with glow
  - **Social media links**: Globe, Instagram, Facebook, Twitter, Youtube icons
  - **Website**: www.jamiat.org.pk
  - Urdu thanks: "جزاك اللہ خیر" + English "Thank You for Watching"
  - Conic gradient rotating background
  - Wrapped in `CinematicWrapper` (preset: cinematic)

### Bonus: UrduTest (standalone, 5s)
- **File**: `src/scenes/UrduTest.tsx`
- Simple test of Urdu rendering with three text animations

### Bonus: DemoScene (standalone, 10s)
- **File**: `src/scenes/DemoScene.tsx`
- Tech demo showcasing all enhancement components:
  - Virtual Camera (zoomIn + pan)
  - ColorGrade (teal-orange)
  - FilmGrain
  - ParticleField (400 particles)
  - CrescentMoon icon with scale/fade animations
  - Feature list with staggered slide-in

---

## 3. Virtual Camera Implementation

**File**: `src/camera/VirtualCamera.tsx`

```typescript
interface CameraMove {
  start: number;    // Start frame
  end: number;      // End frame
  fromX?: number;   // Starting X (default: 0)
  toX?: number;     // Ending X (default: 0)
  fromY?: number;   // Starting Y (default: 0)
  toY?: number;     // Ending Y (default: 0)
  fromScale?: number; // Starting scale (default: 1)
  toScale?: number;   // Ending scale (default: 1)
}
```

- **Mechanism**: Finds the first `CameraMove` whose frame range contains the current frame, then interpolates x/y/scale linearly
- **Rendering**: Applies `transform: translate(x, y) scale(s)` to a wrapping `<div>`
- **Usage**: `<Camera moves={[...]}>` wraps content, accepts array of moves
- **Limitations**: Only one active move at a time; no easing curves (linear interpolation); no composition of multiple simultaneous moves
- **Helper functions** (exported from module): `zoomIn()`, `pan()` — not found as separate exports in the actual code, but used in DemoScene as if imported

### Usage in DemoScene:
```tsx
<Camera moves={[zoomIn(0, 120, 1, 1.15), pan(120, 240, 0, 0, 0, -30)]}>
```
- First 2s: Slow zoom in from 1× to 1.15×
- Next 2s: Pan up 30px

### Note
The virtual camera is **only used in DemoScene** — the main video compositions (IJTVideo, CinematicIJT) do NOT use the camera system. They rely on per-scene spring/interpolate animations instead.

---

## 4. Film Grain Effect

**File**: `src/effects/FilmGrain.tsx`

- **Implementation**: SVG `<filter>` using `feTurbulence` with `fractalNoise`
- **Seed**: Changes every frame (`seed={frame}`) — creates distinct noise per frame
- **Base frequency**: 0.8, 4 octaves
- **Desaturation**: `<feColorMatrix type="saturate" values="0" />` removes color from noise
- **Blend mode**: `mixBlendMode: "overlay"`
- **Intensity**: Controlled via `intensity` prop (default 0.03, range 0–0.1)
- **Usage per scene**:
  - OpeningTitle: 0.02
  - HistoricalFoundation: 0.05 (heaviest grain)
  - MissionPurpose: 0.02
  - Most CinematicWrapper scenes: 0.02
  - DemoScene: 0.03
- **Performance recommendation** (from docs): Keep ≤ 0.04

---

## 5. Pakistan Map

There are **two separate implementations**:

### A. Simple Placeholder Map (`src/components/ui/PakistanMap.tsx`)
- CSS `clipPath: polygon(...)` — abstract pentagon
- Emoji-based placeholder content (🇵🇰)
- Accepts `highlightLahore` prop for a glowing dot
- Used only as a UI component, not in the main scene timeline

### B. D3-Powered Geo Map (`src/visualizations/PakistanMap.tsx`)
- Full GeoJSON rendering with `pakistan.geo.json` (3724 lines, 195KB — all provinces)
- **Projection**: `d3.geoMercator()` centered on Pakistan (69°E, 30°N), scale 2500
- **Province data**: Mock density scores for Punjab (100), Sindh (80), KPK (70), Balochistan (40), etc.
- **Color scheme**: `d3.interpolateGreens` sequential scale
- **Animation**: Staggered province reveal (each province: 15 frame delay, 30 frame fade-in)
- **Labels**: Province names via pathGenerator.centroid
- **Legend**: "IJT Impact Density" gradient bar (Low → High)
- Used in `ImpactVisualization.tsx` at 900×700 size

---

## 6. Audio: Music, Narration, Audio Mixer

### AudioMixer (`src/audio/AudioMixer.tsx`)
- Two `<Audio>` tracks:
  1. **Background Music**: `staticFile("assets/audio/music/opening.mp3")` — Volume 0.4, fade in over 1s, fade out over last 1s
  2. **Voiceover**: `staticFile("assets/audio/voiceover/master.mp3")` — Volume 0.9, no fading

### Sound Effects (`src/audio/SoundEffects.tsx`)
- Library of constants pointing to sound files:
  - WHOOSH, POP, PAGE_TURN, INTRO_BOOM, AMBIENCE_NATURE
  - BACKGROUND_MUSIC, VOICEOVER

### Actual Files on Disk (inside `public/`)
```
public/audio/music/Jazbon Ki Sadaqat Zinda Hai - Hafiz Munir Ahmad.mp3  (11.7 MB)
public/images/departments_chart.png                                       (3.0 MB)
public/images/ijt_logo_official.jpg                                       (9.9 KB)
```

### ⚠️ Audio Path Mismatch Issue
The `AudioMixer` references `assets/audio/music/opening.mp3` and `assets/audio/voiceover/master.mp3` — but these files **do not exist** in `public/`. The only music file has a different name: `Jazbon Ki Sadaqat Zinda Hai - Hafiz Munir Ahmad.mp3`. No voiceover file exists. This would cause **silent audio tracks** during render/studio preview.

---

## 7. Text Animations & Typography

### AnimatedText Component (`src/components/ui/AnimatedText.tsx`)
- **6 animation modes**:
  | Type | Effect | Implementation |
  |---|---|---|
  | `typewriter` | Char-by-char reveal | `text.slice(0, charsShown)` + blinking cursor |
  | `fadeIn` | Opacity fade | `interpolate(frame, [delay, delay+duration], [0, 1])` |
  | `slideUp` | Slide up + fade | `translateY(40→0)` with opacity |
  | `scaleIn` | Spring scale | `remotion/spring` config: SPRING_FAST |
  | `blur` | Blur to clear | `filter: blur(20→0px)` |
  | `glitch` | (defined but same as scaleIn) | Same implementation as scaleIn |
- **Props**: text, type, delay, duration, isUrdu, glow, glowColor
- **Glow**: via `textShadow` + `drop-shadow` CSS

### Font System (`src/utils/fonts.ts`)
- Loaded via `@remotion/google-fonts`:
  - **Noto Nastaliq Urdu** — for Urdu/Arabic text (RTL)
  - **Montserrat (700)** — English headings
  - **Open Sans (400)** — English body text
- Urdu style: `direction: "rtl"`, `unicodeBidi: "bidi-override"`
- Used per-scene with `urduTextStyle` and `englishHeadingStyle` style objects

### Animation Utilities (`src/utils/animations.ts`)
- Spring presets: SPRING_FAST, SPRING_BOUNCY, SPRING_SMOOTH, SPRING_INSTANT
- Easing: EASE_OUT_EXPO, EASE_OUT_BACK, EASE_IN_OUT_QUART
- `staggerDelay(index, baseDelay)` — List stagger helper
- `glowEffect(color, intensity)` — Text glow generator
- `glassmorphism(opacity, blur)` — Glass-style backgrounds
- `floatY(frame, speed, amplitude)` — Floating animation
- `continuousRotation(frame, speed)` — Infinite rotation
- `pulseScale(frame, speed, amplitude)` — Pulsing scale

### Icon Animations (`src/utils/iconAnimations.ts`)
- `scaleSpring()` — Spring-based scale
- `fadeIn()` — Linear fade in
- `slideIn()` — Spring-based slide from X direction
- `drawOnAnimation()` — SVG stroke-dashoffset animation
- `glowPulse()` — Cyclic glow intensity
- `staggerDelay()` — Same as in animations.ts (duplicated)

---

## 8. Export Configuration

**File**: `remotion.config.ts`

| Setting | Value |
|---|---|
| Video image format | JPEG |
| Codec | H.264 |
| CRF (quality) | 20 (relaxed from 18 for stability) |
| Audio bitrate | 320k |
| Pixel format | yuv420p |
| Concurrency | 2 (reduced for stability) |
| Overwrite output | true |

### Per-Composition Settings (set in Root.tsx)
| Composition | Resolution | FPS |
|---|---|---|
| IJT-Introduction | 1920×1080 | 60 |
| Demo-Enhancement-System | 1920×1080 | 60 |
| IJT-Cinematic-Master | **3840×2160 (4K)** | 60 |
| Urdu-Test | 1920×1080 | 60 |

---

## 9. Build & Render Commands

### Development
```bash
npm run dev        # Starts Remotion Studio (localhost)
npm start          # Same as dev
```

### Building
```bash
npm run build      # remotion bundle (produces build/ directory)
```

### Rendering
```bash
npx remotion render Demo-Enhancement-System demo.mp4
npx remotion render IJT-Introduction output.mp4 --codec h264 --crf 18 --concurrency 8
npx remotion render IJT-Cinematic-Master output-4k.mp4
```

### Other
```bash
npm run upgrade    # remotion upgrade
npm run lint       # eslint src && tsc
```

---

## 10. Documentation Quality

| Document | Lines | Quality | Notes |
|---|---|---|---|
| `README.md` | 54 | ⭐⭐ | Generic Remotion template — not customized for this project |
| `QUICK_REFERENCE.md` | 242 | ⭐⭐⭐⭐⭐ | Excellent: usage examples, parameter tables, tips, troubleshooting |
| `FUTURE_ENHANCEMENTS.md` | 734 | ⭐⭐⭐⭐⭐ | Extremely comprehensive 4-phase roadmap (Content Realization → Technical Deepening → Automation → AI) |
| Agent skill files | 30+ files | ⭐⭐⭐⭐ | Remotion best-practices rules in `.agent/`, `.agents/`, `.gemini/` directories |

---

## Key Observations & Issues

### Strengths
1. **Rich visual design**: Consistent dark theme with cyan/coral/gold accents, glassmorphism, glow effects
2. **Modular architecture**: Clean separation into scenes, effects, components, data, utils
3. **Real data integration**: Leadership roster, membership stats, 17 departments — real IJT data
4. **Dual implementation**: HD and 4K versions of the same video
5. **Extensive documentation**: Quick reference and future enhancements docs are thorough
6. **D3 map**: Real GeoJSON map rendering with province-level data

### Issues / Gaps
1. **🔴 Audio path mismatch**: AudioMixer references `opening.mp3` and `master.mp3` that don't exist in `public/`. The actual music file has a different filename. Voiceover file is missing entirely.
2. **🔴 Virtual Camera unused in main video**: Camera system is only demonstrated in DemoScene, not used in the main IJTVideo/CinematicIJT compositions
3. **🟡 Empty transcript**: `src/data/transcript.ts` has all items commented out — captions will never display
4. **🟡 Duplicate components**: Two `ParticleField` implementations (`src/effects/ParticleSystem.tsx` and `src/components/ui/ParticleField.tsx`) with different APIs — potential confusion
5. **🟡 Duplicate animation utilities**: `staggerDelay` exists in both `animations.ts` and `iconAnimations.ts`
6. **🟡 Inconsistent scene wrappers**: Some scenes use `CinematicWrapper` (which applies ColorGrade + FilmGrain), others wrap manually — leading to double ColorGrade in CinematicIJT (scene-level + composition-level)
7. **🟡 ImpactStats.tsx**: A complete scene file exists but is **not imported or used** in the main composition — replaced by ImpactVisualization.tsx
8. **🟡 No scene transitions**: Scene changes are instant (hard cuts) — no fade/wipe transitions between scenes (SceneTransition component exists but is unused)
9. **🟡 No English captions**: For Urdu narration, no English subtitle track is implemented
10. **🟢 Minor**: `src/Composition.tsx` is an unused legacy stub returning null

### Package Dependencies (Notable)
| Package | Purpose |
|---|---|
| `remotion` / `@remotion/*` | Core video framework (v4.0.411) |
| `@react-three/fiber` + `drei` + `three` | 3D rendering (imported but not used yet — for Phase 2) |
| `chart.js` + `react-chartjs-2` | Growth chart visualization |
| `d3` + `topojson-client` | Pakistan map rendering |
| `framer-motion` | Animation library (imported but not used — Remotion's own APIs used instead) |
| `lucide-react` | Icon library |
| `tailwindcss` | CSS utility framework (v4.0) |
| `geojson` | Type definitions for GeoJSON |

---

## File Inventory (Source)

```
src/
├── index.ts                                       # Entry: registerRoot
├── Root.tsx                                       # 4 composition registrations
├── Composition.tsx                                # Legacy stub
├── index.css                                      # @import "tailwindcss"
├── remotion.config.ts                             # Export config (H.264, CRF20, 320k)
├── camera/
│   └── VirtualCamera.tsx                          # Camera movement system
├── audio/
│   ├── AudioMixer.tsx                             # Music + voiceover tracks
│   └── SoundEffects.tsx                           # SFX path constants
├── effects/
│   ├── FilmGrain.tsx                              # SVG feTurbulence grain
│   ├── ColorGrade.tsx                             # CSS filter presets + vignette
│   └── ParticleSystem.tsx                         # SVG particle field
├── compositions/
│   ├── IJTVideo.tsx                               # Main HD composition (13 scenes)
│   └── CinematicIJT.tsx                           # 4K cinematic master
├── config/
│   └── sceneTimings.ts                            # Timing for all scenes
├── scenes/
│   ├── OpeningTitle.tsx                           # Scene 1
│   ├── HistoricalFoundation.tsx                   # Scene 2
│   ├── MissionPurpose.tsx                         # Scene 3
│   ├── IdeologicalFoundations.tsx                 # Scene 4
│   ├── GrowthTimeline.tsx                         # Scene 5
│   ├── OrganizationalStructure.tsx                # Scene 6
│   ├── ActivitiesInitiatives.tsx                  # Scene 7
│   ├── SubOrganizations.tsx                       # Scene 8
│   ├── GlobalConnections.tsx                      # Scene 9
│   ├── CoreValues.tsx                             # Scene 10
│   ├── ImpactVisualization.tsx                    # Scene 11 (chart + map)
│   ├── ImpactStats.tsx                            # Unused stats scene
│   ├── FutureVision.tsx                           # Scene 12
│   ├── ClosingOutro.tsx                           # Scene 13
│   ├── DemoScene.tsx                              # Tech demo
│   └── UrduTest.tsx                               # Urdu rendering test
├── components/
│   ├── icons/
│   │   └── CrescentMoon.tsx                       # SVG crescent with glow
│   ├── layout/
│   │   ├── CinematicWrapper.tsx                   # ColorGrade + FilmGrain wrapper
│   │   └── SplitScreen.tsx                        # Flex split layout
│   ├── effects/
│   │   ├── SceneTransition.tsx                    # Fade/wipe transitions (unused)
│   │   └── AnimatedBackground.tsx                 # Gradient/mesh backgrounds
│   └── ui/
│       ├── AnimatedText.tsx                       # 6 animation styles
│       ├── Captions.tsx                           # Transcript captions display
│       ├── PakistanMap.tsx                        # Placeholder map (clipPath)
│       ├── Logo.tsx                               # IJT logo placeholder
│       ├── StatCard.tsx                           # Animated stat card
│       ├── NetworkNode.tsx                        # Network graph node
│       ├── ValueIcon.tsx                          # Orbiting value icon
│       ├── TimelineEra.tsx                        # Timeline era display
│       ├── Pillar.tsx                             # Mission pillar card
│       ├── OptimizedMedia.tsx                     # Lazy-loading media
│       └── ParticleField.tsx                      # CSS particle field (duplicate)
├── visualizations/
│   ├── GrowthChart.tsx                            # Chart.js line chart
│   └── PakistanMap.tsx                            # D3 GeoJSON map
├── utils/
│   ├── colors.ts                                  # Color palette
│   ├── animations.ts                              # Spring/easing/effect helpers
│   ├── iconAnimations.ts                          # Dedicated icon animation helpers
│   └── fonts.ts                                   # Google font loading
└── data/
    ├── transcript.ts                              # Caption transcript (empty)
    ├── leadership.ts                              # Current & past presidents
    ├── membership.ts                              # Membership growth data
    ├── departments.ts                             # 17 departments
    └── pakistan.geo.json                          # Pakistan province GeoJSON
```
