# Product

## Register

brand

## Users

Casual baseball fans and the maker. People who already follow the sport and want a fast,
satisfying read of a single hitter's season — not analysts running queries. The job is
recognition, not research: type a player, and instantly *see* the shape of their year —
hot stretches, cold spells, the big multi-base games — with enough detail on demand
(opponent, batting line) to satisfy curiosity. Success is the moment someone says "oh,
*that's* what his June looked like" and then searches a second player for the fun of it.

## Product Purpose

Light it Up (repo: tbgraph) turns a season of total bases into a GitHub-contributions-style heatmap: one cell
per game, color intensity by total bases, hover for the matchup and batting line. It exists
as a showpiece — a small, sharp object that's a pleasure to look at and use, built on the
public MLB StatsAPI with no build step. The data must be honest and the read must be
instant, but the bar is higher than "functional": the interface itself is the thing being
shown off.

## Brand Personality

Sporty, energetic, confident. Think the energy of a scoreboard or a broadcast graphics
package, not a spreadsheet. Three words: **lively, precise, legible.** The heatmap is the
hero — color and rhythm carry the personality, while typography and chrome stay disciplined
enough that the data always reads clearly. Personality lives in the palette, the motion, and
the moments of delight, never in clutter.

## Anti-references

- **Generic SaaS dashboards.** No gradient-card grids, no hero-metric template (big number +
  small label + supporting stats), no cookie-cutter admin-panel chrome.
- **Cluttered stat sheets.** Not ESPN / Baseball-Reference table overload. One player, one
  clear visual, detail on demand — never a dense grid of numbers competing for attention.
- The current default look (Tailwind-CDN gray-on-white, default green ring, system fonts)
  is a placeholder, not the brand. The showpiece version should not look like an unstyled
  starter.

## Design Principles

- **The heatmap is the hero.** Every other element earns its place by helping someone read
  the grid faster or enjoy it more. When in doubt, give the grid more room and quiet
  everything else.
- **Honest data, instant read.** Accuracy is non-negotiable and the path from search to
  insight is short. Never sacrifice legibility of the data for decoration.
- **Energy through restraint.** The sporty feel comes from a committed, confident palette
  and intentional motion — not from piling on effects. One strong idea beats five loud ones.
- **Delight on the path, not in the way.** Micro-interactions (search, hover, reveal) should
  feel good, but never block, lag, or distract from reading a player's season.
- **Inclusive by default.** The showpiece only works if everyone can read it: AA contrast,
  full keyboard support, reduced-motion alternatives, and a color ramp that survives
  red-green color blindness.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA**: body text ≥ 4.5:1, large text ≥ 3:1, against actual backgrounds.
- **Color is never the only signal.** The total-bases ramp must stay distinguishable for
  red-green color blindness — pair intensity with luminance steps (and consider an explicit
  value/number affordance), so the grid is readable without relying on hue alone.
- **Full keyboard support** for search, suggestions, and grid cells, with visible focus.
- **Honor `prefers-reduced-motion`:** every animation needs a crossfade/instant alternative
  (the loading spinner currently does not — fix as part of the showpiece pass).
- Tooltips and live regions announce to assistive tech (the current `aria-live` tooltip is
  the right instinct; preserve it).
