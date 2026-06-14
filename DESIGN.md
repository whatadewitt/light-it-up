---
name: Light it Up
description: A phosphor-green stadium-scoreboard heatmap of an MLB hitter's season.
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
scaled to the total bases of a single game. The whole system exists to make one thing —
the heatmap — feel alive and worth looking at, the way a scoreboard does when the home team
is hot. Energy comes from a single committed signal color and the way light reads off a
dark field, not from ornament. Everything that isn't the board stays quiet so the board can
shout.

The system explicitly rejects the **generic SaaS dashboard** (gradient-card grids, the
hero-metric template of big-number-plus-supporting-stats, cookie-cutter admin chrome) and
the **cluttered stat sheet** (ESPN / Baseball-Reference table overload, dense numbers
competing for attention). It is also a deliberate move away from its own origin: a
GitHub-contributions grid in default greens on white. Here the grid is reframed as a
stadium board — warm, emissive, and dark.

**Key Characteristics:**
- One hero (the heatmap), one signal color (phosphor green), one dark field.
- Intensity is carried by **luminance**, never hue alone — colorblind-safe by construction.
- Athletic, signage-grade display type over disciplined, legible body type.
- Light, not shadow: depth is tonal layering plus the glow a bulb emits.
- Quiet chrome, loud data. If an element doesn't help you read the board faster or enjoy it
  more, it gets smaller or disappears.

## 2. Colors

A committed dark palette: one saturated phosphor green doing all the signaling, spread over
a near-black stadium field with cool slate panels. Color is the brand here — used with
intent, never as decoration.

### Primary
- **Scoreboard Phosphor** (#5be684): the single brand signal. It marks live data (the
  brightest played games), focus rings, the search-active state, the loading pulse, stat
  values, and links. Nothing decorative is ever phosphor.
- **Phosphor Deep** (#39c463): the mid-intensity green; the resting strength of the signal
  for medium-value games and search-icon accents.

### Neutral
- **Outfield Black** (#090d12): the body — the dark field at night. A faint **Field Glow**
  (#0c1825) washes from the top center, like the bowl lights.
- **Press-Box Slate** (#111a23) and **Press-Box Slate Raised** (#16212c): the board frame
  and the raised surfaces (suggestions, tooltip). Layered tonally, never with heavy shadow.
- **Line** (#243240) / **Line Soft** (#1b2733): hairline borders and the nameplate divider.
- **Stadium Light** (#eaf1f7): primary text. **Stadium Light Dim** (#a7b7c6): secondary
  text (subhead, tooltip line, legend) — verified > 7:1 on Outfield Black. **Stadium Light
  Faint** (#7c8b9a): tertiary micro-text only (labels, colophon), ~5:1, never body.

### Tertiary
- **Warning Track** (#ff7a6b on bg #2a1512): the only non-green accent, reserved for errors.
  Muted, never flashing.

### The Ignition Ramp
The total-bases scale, dark filament to white-hot. **Luminance climbs monotonically** so the
value is legible without relying on hue:
- **Ignition 0** (#17241d): a played game with no total bases — a lit-but-dark bulb.
- **Ignition 1** (#2f7d4a) → **2** (#39c463) → **3** (#5be684) → **4** (#9dffba, the
  brightest, 7+ total bases, with the strongest glow).

The board shows the player's **whole team season** in schedule order, so two non-lit
states sit alongside the ramp:
- **Did Not Play** (#283440): a team game the player missed (injured, rested) — a filled,
  muted slate slot, clearly "a game happened, he wasn't in it." It carries a hover tooltip
  ("vs BOS · Did not play") but is not keyboard-focusable.
- **Dark Socket** (#0e151b): a game *not yet played* — a hollow, unlit socket. Distinct from
  both Ignition 0 (a played hitless game) and Did Not Play, on purpose.

### Named Rules
**The Luminance Rule.** The Ignition Ramp is read by brightness, not hue. Every step is
lighter than the last. Never encode the value of a game in hue alone — a red-green colorblind
viewer must still read the board correctly.

**The One Signal Rule.** Phosphor green is the only saturated color on the surface. It means
"live / focused / this is the data." If you find yourself reaching for phosphor as decoration,
stop — use a slate or an ink tone instead. The one prose exception is the words "total bases"
in the masthead subhead: phosphor there names the metric the whole tool is about, so it reads
as signal, not decoration.

**The Three-State Rule.** Every slot is exactly one of: **played** (lit bulb on the Ignition
ramp — tooltip + keyboard focus, including Ignition 0 for a hitless game), **did not play**
(#283440 filled slate — hover tooltip, not focusable), or **not yet played** (#0e151b hollow
socket — inert). Never conflate them; reading the season as played / missed / upcoming is the
whole point of laying all the team's games out in schedule order.

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
- **Title** (Hanken Grotesk 700, clamp 1.25–1.5rem, tabular): the big stat values (Games, Total
  Bases, Best Game).
- **Body** (Hanken Grotesk 400, 15–16px, line 1.55): the subhead and prose. Measure capped ~52ch.
- **Label** (Hanken Grotesk 600, 0.64rem, +0.08em, UPPERCASE): stat labels, the search label,
  search label. Short strings only.

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
**glow a bulb emits**, a `box-shadow` used as light, scaled to the game's value.

### Shadow Vocabulary
- **Bulb glow** (`box-shadow: 0 0 5px–14px -1px <ramp color at alpha>`): emitted light on
  played cells, brighter with value. On hover it blooms (larger radius, higher alpha).
- **Float drop** (`box-shadow: 0 18px 40px -16px rgba(0,0,0,0.7)` for the dropdown;
  `0 12px 30px -12px rgba(0,0,0,0.8)` for the tooltip): genuine overlay depth, nothing else.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(91,230,132,0.14)` on the search field): a soft
  phosphor halo, paired with a phosphor border.

### Named Rules
**The Light-Not-Shadow Rule.** Surfaces are flat and separated by tone. When you need depth,
ask whether the element *emits* (a bulb → glow) or *floats* (a menu → drop shadow). Decorative
ambient shadows on flat panels are forbidden.

## 5. Components

### Search Field
- **Style:** A single slate field (#111a23), 1px Line border, 10px radius, with a leading
  search glyph that turns phosphor on focus.
- **Focus:** Border shifts to phosphor; a 3px phosphor halo (`--phosphor-wash`) appears. No
  default browser outline.
- **Suggestions:** A `position: absolute` listbox on Press-Box Slate Raised with a Float-drop
  shadow; each row is a flush list item, active/hover state is a phosphor wash with the team
  abbreviation turning phosphor. Full keyboard combobox semantics (`aria-activedescendant`).

### The Heatmap Board (signature component)
- **Layout:** A breakpoint-free grid — `grid-template-columns: repeat(auto-fill, var(--cell))`,
  capped at 30 columns (`max-width: calc(30·cell + 29·gap)`). One slot per **team game** in
  schedule order (the full ~162-game regular season); the player's games are dropped into their
  real calendar positions by `gamePk`, so an injury reads as a visible gap.
- **Cell shape:** `var(--cell)` square (clamp 13–17px), 4px radius. Default is a Dark Socket.
- **States (three):** *played* = Ignition ramp by luminance with bulb glow, `tabindex="0"`,
  `role="img"` with a full `aria-label`, broadcast tooltip on hover/focus, hover lifts and
  blooms (`translateY(-1px) scale(1.18)`); *did not play* = filled slate (#283440), hover
  tooltip ("vs BOS · Did not play"), not focusable; *not yet played* = dark socket, inert.
- **Reveal:** On load the played slots ignite **in game order, 1→N**, via a per-cell
  `transition-delay` (4ms step) hard-capped at 640ms total, so even a full 162 lights fast.
  Switching players fades the board to sockets first, then re-ignites. Delays are cleared once
  the sweep ends so hover stays instant.

### Nameplate (broadcast lower-third)
- **Style:** Player name in Headline (Archivo Black) at left; a right-aligned cluster of stats
  (Games / Total Bases / Best Game), each a phosphor tabular value over an uppercase faint
  label. Separated from the board by a 1px Line-Soft divider. While loading, the stats slot
  shows a pulsing-phosphor "Loading season…".

### Legend
- **Style:** The five-step Ignition ramp between "Fewer bases / More bases", plus two separated
  swatches — "Did not play" (slate) and "Not yet played" (dark socket) — so the two kinds of
  non-lit slot read as intentional.

### Tooltip (data chip)
- **Style:** A small Press-Box Slate Raised chip, phosphor-line border, 4px radius, Float-drop
  shadow. Matchup line in phosphor tabular ("vs. BOS"), batting line in dim ink ("3 / 4, 2B,
  HR"). `position: fixed`, flips to stay in viewport, `pointer-events: none`.

### Tag / Chip
- **Style:** A phosphor-wash pill with a phosphor-line border and phosphor tabular text
  (e.g. "MLB · 2026"). Used as a metadata marker, never as a button.

### Alert
- **Style:** A Warning-Track panel (#2a1512 bg, #5a261f border, 10px radius) with a leading
  glowing dot and light-coral text. `role="alert"`. Never flashes.

## 6. Do's and Don'ts

### Do:
- **Do** let the heatmap be the hero — give it the most room and quiet everything else.
- **Do** carry game value with **luminance** (the Ignition Ramp), and pair color with a
  non-color signal (the tooltip's exact number) so the board is readable without hue.
- **Do** keep phosphor green rare and meaningful (live data, focus, links) — the One Signal Rule.
- **Do** reserve Archivo Black for the masthead and nameplate only; everything else is Hanken Grotesk.
- **Do** convey depth with tone and emitted glow, not ambient drop shadows (the Light-Not-Shadow Rule).
- **Do** honor `prefers-reduced-motion`: the ignite sweep collapses to an instant swap.
- **Do** keep AA contrast — body ≥ 4.5:1, large text ≥ 3:1 — and keep every interactive slot
  keyboard-reachable with a visible focus ring.

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
