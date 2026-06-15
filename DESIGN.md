---
name: Light it Up
description: A stadium-scoreboard heatmap covering MLB, NHL, NFL, and NBA — one signal accent per selected league.
colors:
  outfield-black: "#090d12"
  field-glow: "#0c1825"
  press-box-slate: "#111a23"
  press-box-slate-raised: "#16212c"
  line: "#243240"
  line-soft: "#1b2733"
  stadium-light: "#eaf1f7"
  stadium-light-dim: "#a7b7c6"
  stadium-light-faint: "#7c8b9a"
  scoreboard-phosphor: "#5be684"
  phosphor-deep: "#39c463"
  dark-socket: "#0e151b"
  did-not-play: "#283440"
  ignition-0: "#17241d"
  ignition-1: "#2f7d4a"
  ignition-2: "#39c463"
  ignition-3: "#5be684"
  ignition-4: "#9dffba"
  warning-track: "#ff7a6b"
  warning-track-bg: "#2a1512"
  warning-track-line: "#5a261f"
typography:
  display:
    fontFamily: "Archivo Black, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3.25rem)"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo Black, system-ui, sans-serif"
    fontSize: "clamp(1.55rem, 5.5vw, 2.4rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 4.5vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "normal"
    fontFeature: "tnum"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(15px, 0.4vw + 14px, 16px)"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.64rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "10px"
  pill: "999px"
components:
  search-field:
    backgroundColor: "{colors.press-box-slate}"
    textColor: "{colors.stadium-light}"
    rounded: "{rounded.md}"
    padding: "0.85rem 0.95rem"
  suggestion:
    textColor: "{colors.stadium-light}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 0.7rem"
  cell:
    backgroundColor: "{colors.dark-socket}"
    rounded: "{rounded.sm}"
    size: "clamp(13px, 3.4vw, 17px)"
  cell-played-4:
    backgroundColor: "{colors.ignition-4}"
    rounded: "{rounded.sm}"
  tag:
    backgroundColor: "rgba(91,230,132,0.14)"
    textColor: "{colors.scoreboard-phosphor}"
    rounded: "{rounded.pill}"
    padding: "0.34em 0.7em"
  tooltip:
    backgroundColor: "{colors.press-box-slate-raised}"
    textColor: "{colors.stadium-light-dim}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.7rem"
  alert:
    backgroundColor: "{colors.warning-track-bg}"
    textColor: "#ffd9d2"
    rounded: "{rounded.md}"
    padding: "0.9rem 1.1rem"
---

# Design System: Light it Up

## 1. Overview

**Creative North Star: "The Night Scoreboard"**

This is an incandescent stadium scoreboard after dark. The page is the black field at
night; a player's season ignites across it as a panel of bulbs, each one's brightness
scaled to the league's metric for a single game. The whole system exists to make one thing —
the heatmap — feel alive and worth looking at, the way a scoreboard does when the home team
is hot. Energy comes from a single committed signal color **per selected league** and the way
light reads off a dark field, not from ornament. Everything that isn't the board stays quiet
so the board can shout.

The tool covers four leagues — MLB, NHL, NFL, and NBA — each lit in its own signal accent:
phosphor green for MLB, magenta for NHL, blue for NFL, orange for NBA. The scoreboard is the
same scoreboard every time; only the signal color and the metric it measures change.

The system explicitly rejects the **generic SaaS dashboard** (gradient-card grids, the
hero-metric template of big-number-plus-supporting-stats, cookie-cutter admin chrome) and
the **cluttered stat sheet** (ESPN / Baseball-Reference table overload, dense numbers
competing for attention). It is also a deliberate move away from its own origin: a
GitHub-contributions grid in default greens on white. Here the grid is reframed as a
stadium board — warm, emissive, and dark.

**Key Characteristics:**
- One hero (the heatmap), one signal color **per selected league**, one dark field.
- Intensity is carried by **luminance**, never hue alone — colorblind-safe by construction
  in all four league accents.
- Athletic, signage-grade display type over disciplined, legible body type.
- Light, not shadow: depth is tonal layering plus the glow a bulb emits.
- Quiet chrome, loud data. If an element doesn't help you read the board faster or enjoy it
  more, it gets smaller or disappears.

## 2. Colors

A committed dark palette: one saturated accent per selected league doing all the signaling,
spread over a near-black stadium field with cool slate panels. Color is the brand here —
used with intent, never as decoration.

### Neutral (shared across all leagues)
- **Outfield Black** (#090d12): the body — the dark field at night. A faint **Field Glow**
  (#0c1825) washes from the top center, like the bowl lights.
- **Press-Box Slate** (#111a23) and **Press-Box Slate Raised** (#16212c): the board frame
  and the raised surfaces (suggestions, tooltip). Layered tonally, never with heavy shadow.
- **Line** (#243240) / **Line Soft** (#1b2733): hairline borders and the nameplate divider.
- **Stadium Light** (#eaf1f7): primary text. **Stadium Light Dim** (#a7b7c6): secondary
  text (subhead, tooltip line, legend) — verified > 7:1 on Outfield Black. **Stadium Light
  Faint** (#7c8b9a): tertiary micro-text only (labels, colophon), ~5:1, never body.

### Tertiary
- **Warning Track** (#ff7a6b on bg #2a1512): the only non-accent hue, reserved for errors.
  Muted, never flashing.

### League Accents and the `data-league` Token Mechanism

The accent is the single signal color for the currently selected league. Selecting a league
sets `data-league` on `document.documentElement`, which triggers a `:root[data-league="…"]`
CSS override of four semantic tokens:

- `--accent`: the peak signal hue
- `--accent-wash`: a low-alpha fill of the accent (focus halos, suggestion highlights)
- `--accent-line`: a mid-alpha border of the accent (focus borders, tooltip borders)
- `--ramp-0` through `--ramp-4`: the five-step metric ramp for that league

Per-cell bulb glows are derived from the ramp via `color-mix()` — e.g.
`box-shadow: 0 0 5px -1px color-mix(in srgb, var(--ramp-1) 55%, transparent)` — so
no hard-coded glow color exists; everything inherits from the active league.
Neutral tokens (field, slate, ink) are never overridden and stay shared.

The four league accents, all AA on Outfield Black (#090d12):

| League | Accent | Contrast | Ramp (0 → 4) |
|--------|--------|----------|--------------|
| **MLB** (default) | `#5be684` | 12.2:1 | `#17241d` `#2f7d4a` `#39c463` `#5be684` `#9dffba` |
| **NHL** | `#ff5cc8` | 7.1:1  | `#241522` `#8e2f63` `#c44f97` `#ff5cc8` `#ffb3e6` |
| **NFL** | `#5ca8ff` | 7.9:1  | `#141d2e` `#2f5a9c` `#3f8fd6` `#5ca8ff` `#bfe0ff` |
| **NBA** | `#ff9d3c` | 9.4:1  | `#2a1a0e` `#9c5a1f` `#e08a2e` `#ff9d3c` `#ffd9a0` |

**Scoreboard Phosphor** (#5be684) and **Phosphor Deep** (#39c463) remain the MLB/default
accent values and are carried in the neutral palette for legacy reference.

### The Metric Ramp (per league)

Each league has a five-step luminance ramp that scales game value from dark filament to
white-hot. **Luminance climbs monotonically** so the value is legible without relying on
hue. The ramp's steps correspond to:

- **Ramp 0**: a played game at the lowest bucket — a lit-but-dark bulb.
- **Ramp 1 → 4**: increasing brightness up to the peak value with the strongest glow.

The metric each ramp encodes:
- **MLB**: total bases per game (5 buckets: 0, 1–2, 3–4, 5–6, 7+)
- **NHL**: points (G+A) per game
- **NFL**: total yards per quarter (each cell = one quarter; 17 games × 4 quarters = 68 cells)
- **NBA**: points per game

The board shows the player's **whole team season** in schedule order, so two non-lit
states sit alongside the ramp:
- **Did Not Play** (#283440): a team game the player missed (injured, rested) — a filled,
  muted slate slot, clearly "a game happened, he wasn't in it." It carries a hover tooltip
  ("vs BOS · Did not play") but is not keyboard-focusable.
- **Dark Socket** (#0e151b): a game *not yet played* — a hollow, unlit socket. Distinct from
  both Ramp 0 (a played game at zero) and Did Not Play, on purpose.

### Named Rules

**The Luminance Rule.** Every league's metric ramp is read by brightness, not hue. Every
step is lighter than the last. Never encode the value of a game in hue alone — a red-green
colorblind viewer must still read the board correctly. This holds for all four league accents.

**The One Signal Rule.** The accent is the only saturated color on the surface; which hue
that is depends on the selected league. It means "live / focused / this is the data." If
you find yourself reaching for the accent as decoration, stop — use a slate or an ink tone
instead. The one prose exception is the metric name in the masthead subhead (e.g. "total
bases" for MLB, "points" for NHL): the accent there names the metric the whole view is
about, so it reads as signal, not decoration.

**The Three-State Rule.** Every slot is exactly one of: **played** (lit bulb on the metric
ramp — tooltip + keyboard focus, including Ramp 0 for a zero-metric game), **did not play**
(#283440 filled slate — hover tooltip, not focusable), or **not yet played** (#0e151b hollow
socket — inert). Never conflate them; reading the season as played / missed / upcoming is the
whole point of laying all the team's games out in schedule order. Note: NFL cells are
per-quarter, so a 17-game season yields 68 slots; the three states apply identically.

## 3. Typography

**Display Font:** Archivo Black (with system-ui fallback)
**Body / UI Font:** Hanken Grotesk (400–700)

**Character:** A two-family pairing on a deliberate contrast axis. Archivo Black is the
signage voice — wide, heavy, industrial, scoreboard-grade — used only for the two display
moments (masthead + nameplate). Hanken Grotesk carries everything else: a humanist grotesque
that's warmer and more open than the industrial display, highly legible at small sizes, with
clean tabular figures for all the numbers (stats, batting lines, matchups). The pairing reads
as the same confident voice at two registers — loud signage over precise, human body text.

### Hierarchy
- **Display** (Archivo Black 900, clamp 2–3.25rem, line 0.94, −0.01em): the masthead
  "Light it Up" only.
- **Headline** (Archivo Black 900, clamp 1.55–2.4rem, line 1, −0.015em): the player nameplate.
- **Title** (Hanken Grotesk 700, clamp 1.25–1.5rem, tabular): the big stat values (Games,
  league metric total, Best Game).
- **Body** (Hanken Grotesk 400, 15–16px, line 1.55): the subhead and prose. Measure capped ~52ch.
- **Label** (Hanken Grotesk 600, 0.64rem, +0.08em, UPPERCASE): stat labels, the search label.
  Short strings only.

### Named Rules
**The Scoreboard Weight Rule.** Archivo Black appears exactly twice — the masthead and the
nameplate. Body, labels, and stats are always Hanken Grotesk. A page full of black weight is
shouting, not designing.

**The Tabular Rule.** Every number — stat values, batting lines, the tag, the matchup — uses
tabular figures (`font-variant-numeric: tabular-nums`). Scoreboards don't let digits wobble.

## 4. Elevation

This system is **flat with tonal layering, plus emitted light**. Depth is built by stepping
the surface tone (Outfield Black → Press-Box Slate → Press-Box Slate Raised), not by stacking
drop shadows. Drop shadows exist only where something genuinely floats over content (the
suggestions dropdown, the tooltip). The signature "elevation" is not shadow at all — it's the
**glow a bulb emits**, a `box-shadow` used as light, scaled to the game's value, derived from
the active league's ramp via `color-mix()`.

### Shadow Vocabulary
- **Bulb glow** (`box-shadow: 0 0 5px–14px -1px color-mix(in srgb, var(--ramp-N) α%, transparent)`):
  emitted light on played cells, brighter with value, automatically inheriting the active
  league accent. On hover it blooms (larger radius, higher alpha).
- **Float drop** (`box-shadow: 0 18px 40px -16px rgba(0,0,0,0.7)` for the dropdown;
  `0 12px 30px -12px rgba(0,0,0,0.8)` for the tooltip): genuine overlay depth, nothing else.
- **Focus ring** (`box-shadow: 0 0 0 3px var(--accent-wash)` on the search field): a soft
  accent halo, paired with an accent border — color follows the active league.

### Named Rules
**The Light-Not-Shadow Rule.** Surfaces are flat and separated by tone. When you need depth,
ask whether the element *emits* (a bulb → glow) or *floats* (a menu → drop shadow). Decorative
ambient shadows on flat panels are forbidden.

## 5. Components

### League Switcher (masthead)
- **Style:** A segmented tab control (`role="tablist"`, four `.league-tab` buttons with
  `role="tab"`) sitting in the masthead alongside the title. Each tab carries its **own**
  league accent via a per-tab CSS custom property (`--tab`): MLB green, NHL magenta, NFL blue,
  NBA orange — all four hues are visible simultaneously even when one league is active.
- **Active state:** The selected tab is filled solid in its accent (`background: var(--tab)`),
  with dark ink text for contrast. Inactive tabs show the accent only as a border on hover.
- **Interaction:** Clicking a tab or pressing arrow keys (keyboard nav) sets `data-league` on
  `document.documentElement`, updates `aria-selected`, deep-links via the URL hash, and
  instantly recolors the entire theme (all `--accent*` and `--ramp-*` tokens). Under
  `prefers-reduced-motion`, all transitions collapse to instant swaps.
- **Dynamic copy:** Switching leagues updates the masthead subhead metric name, legend labels
  ("Fewer / More [metric]"), the page `<title>`, and the search field `aria-label` — all
  reflect the new league's terminology.
- **Accessibility:** `role="tablist"` / `role="tab"` / `aria-selected`; arrow-key navigation
  between tabs; visible focus ring in the tab's own accent color (`outline: 2px solid var(--tab)`).

### Search Field
- **Style:** A single slate field (#111a23), 1px Line border, 10px radius, with a leading
  search glyph that turns the active accent on focus.
- **Focus:** Border shifts to `--accent-line`; a 3px `--accent-wash` halo appears. No
  default browser outline.
- **Suggestions:** A `position: absolute` listbox on Press-Box Slate Raised with a Float-drop
  shadow; each row is a flush list item, active/hover state is an accent wash with the team
  abbreviation turning accent. Full keyboard combobox semantics (`aria-activedescendant`).
- **Dynamic:** The `aria-label` is updated per league (e.g. "Search for an active NHL player").

### The Heatmap Board (signature component)
- **Layout:** A breakpoint-free grid — `grid-template-columns: repeat(auto-fill, var(--cell))`,
  capped at 30 columns. Slots per season: ~162 for MLB, ~82 for NHL, 68 (17 games × 4 quarters)
  for NFL, ~82 for NBA. A player's game slots drop into their real calendar positions in
  schedule order, so gaps read as missed games.
- **Cell shape:** `var(--cell)` square (clamp 13–17px), 4px radius. Default is a Dark Socket.
- **States (three):** *played* = metric ramp by luminance with bulb glow (via `color-mix()`),
  `tabindex="0"`, `role="img"` with a full `aria-label`, broadcast tooltip on hover/focus,
  hover lifts and blooms (`translateY(-1px) scale(1.18)`); *did not play* = filled slate
  (#283440), hover tooltip ("vs BOS · Did not play"), not focusable; *not yet played* = dark
  socket, inert.
- **Reveal:** On load the played slots ignite **in game order, 1→N**, via a per-cell
  `transition-delay` (4ms step) hard-capped at 640ms total. Switching players fades the board
  to sockets first, then re-ignites. Switching leagues triggers an instant recolor of the
  whole ramp.

### Nameplate (broadcast lower-third)
- **Style:** Player name in Headline (Archivo Black) at left; a right-aligned cluster of stats
  (Games / league metric total / Best Game), each an accent tabular value over an uppercase
  faint label. Separated from the board by a 1px Line-Soft divider. While loading, the stats
  slot shows a pulsing-accent "Loading season…".
- **Dynamic:** The stat labels and values reflect the active league's metric (e.g. "Total Bases"
  for MLB, "Points" for NHL, "Total Yards" for NFL).

### Legend
- **Style:** The five-step metric ramp between "Fewer [metric] / More [metric]" (labels are
  dynamic per league), plus two separated swatches — "Did not play" (slate) and "Not yet
  played" (dark socket). The ramp swatches automatically inherit the active league's `--ramp-*`
  tokens, so the legend recolors with the theme.

### Tooltip (data chip)
- **Style:** A small Press-Box Slate Raised chip, accent-line border, 4px radius, Float-drop
  shadow. Matchup line in accent tabular ("vs. BOS"), game line in dim ink. `position: fixed`,
  flips to stay in viewport, `pointer-events: none`.

### Tag / Chip
- **Style:** An accent-wash pill with an accent-line border and accent tabular text
  (e.g. "MLB · 2026"). Used as a metadata marker, never as a button.

### Alert
- **Style:** A Warning-Track panel (#2a1512 bg, #5a261f border, 10px radius) with a leading
  glowing dot and light-coral text. `role="alert"`. Never flashes.

## 6. Do's and Don'ts

### Do:
- **Do** let the heatmap be the hero — give it the most room and quiet everything else.
- **Do** carry game value with **luminance** (the metric ramp), and pair color with a
  non-color signal (the tooltip's exact number) so the board is readable without hue.
- **Do** keep the accent rare and meaningful (live data, focus, links) — the One Signal Rule.
- **Do** reserve Archivo Black for the masthead and nameplate only; everything else is Hanken Grotesk.
- **Do** convey depth with tone and emitted glow, not ambient drop shadows (the Light-Not-Shadow Rule).
- **Do** honor `prefers-reduced-motion`: the ignite sweep and league-switch recolor collapse to
  instant swaps.
- **Do** keep AA contrast — body ≥ 4.5:1, large text ≥ 3:1 — for all four league accents, and
  keep every interactive slot keyboard-reachable with a visible focus ring.

### Don't:
- **Don't** build a **generic SaaS dashboard**: no gradient-card grids, no hero-metric template
  (big number + small label + supporting stats + gradient accent), no admin-panel chrome.
- **Don't** build a **cluttered stat sheet**: no ESPN / Baseball-Reference table overload, no
  dense numbers competing with the board. One player, one clear visual, detail on demand.
- **Don't** regress to the **Tailwind-placeholder look** (gray-on-white, default green focus
  ring, system fonts). That was the unstyled starter, not the brand.
- **Don't** use gradient text (`background-clip: text` + gradient) — solid ink only; emphasis
  via weight and size.
- **Don't** encode a game's value in hue alone, and never give a Dark Socket (future game) a
  tooltip, a glow, or keyboard focus.
- **Don't** add decorative glassmorphism or ambient shadows on flat panels.
- **Don't** hard-code a league's accent color anywhere — always use `var(--accent)`,
  `var(--accent-wash)`, `var(--accent-line)`, and `var(--ramp-*)` so the theme token
  mechanism can do its job.
