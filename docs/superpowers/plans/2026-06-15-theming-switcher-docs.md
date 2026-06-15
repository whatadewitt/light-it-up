# Multi-Accent Theming + League Switcher + Docs Implementation Plan

> **For agentic workers:** Mixed execution — the theming/design tasks are controller-led with the **impeccable** skill + live browser AA verification + user sign-off; the switcher/wiring tasks are concrete and subagent-friendly. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make all four leagues reachable and themed — a persistent header **league switcher** (URL-hash deep-linked) that recolors the whole UI to the selected league's accent (MLB green / NHL magenta / NFL blue / NBA orange), with dynamic per-sport masthead/legend/status text, plus updated design docs and a `docs/data-sources.md`.

**Architecture:** `styles.css` moves from hardcoded phosphor-green to **semantic accent tokens** (`--accent`, `--accent-wash`, `--accent-line`, `--ramp-0..--ramp-4`) overridden by `:root[data-league="…"]`; per-level bulb glows are derived from the ramp via `color-mix()` so a league only overrides its ramp + accent. `app.js` reads the league from the URL hash, sets `documentElement.dataset.league`, and on switch swaps `currentProvider`, reloads players, resets the board, and rewrites the dynamic text. Providers gain `seasonLabel` + `metricShort` for the dynamic copy.

**Tech Stack:** Vanilla ES modules, no build. `node --test` (`/opt/homebrew/bin/node`). impeccable skill for the accent system + `DESIGN.md`/`.impeccable/design.json`. Browser verification via Chrome DevTools (≥500px). Worker already deployed; no Worker changes here.

**Conventions:** run Node as `/opt/homebrew/bin/node`; commit after each task with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Don't touch `worker/` or the provider data logic (only add `seasonLabel`/`metricShort`).

**Carry-forwards from Plan 2 (must be handled in Task 3):**
1. In `loadPlayer`, capture `const provider = currentProvider` at the top and use it throughout, so a mid-flight league switch can't render the new provider's labels over the old provider's data.
2. Add a `shrinkBoard` path — the board grid currently only grows; switching from MLB (162) to NFL (68) must remove the extra cells.

---

### Task 1: Tokenize the theme + per-league accents (controller-led, impeccable)

**Files:** `styles.css` (+ `DESIGN.md`, `.impeccable/design.json` in Task 5). **Use the impeccable skill** for the accent design and to keep the docs in sync.

Design + apply:
- [ ] **Step 1: Introduce semantic tokens in `:root`** — add `--accent`, `--accent-wash`, `--accent-line`, `--ramp-0..--ramp-4` set to today's green values:
  ```css
  --accent: #5be684; --accent-wash: rgba(91,230,132,0.14); --accent-line: rgba(91,230,132,0.38);
  --ramp-0:#17241d; --ramp-1:#2f7d4a; --ramp-2:#39c463; --ramp-3:#5be684; --ramp-4:#9dffba;
  ```
  Keep `--socket`, `--out`, all neutrals, type, geometry, motion unchanged. Leave the old `--phosphor*`/`--tb-*` names as aliases pointing at the new tokens (e.g. `--phosphor: var(--accent);`) so nothing breaks mid-refactor, OR replace all references (preferred — see Step 2).
- [ ] **Step 2: Replace references** throughout `styles.css`: `--phosphor`→`--accent`, `--phosphor-wash`→`--accent-wash`, `--phosphor-line`→`--accent-line`, `--tb-0..4`→`--ramp-0..4`. Then remove the now-unused old token definitions.
- [ ] **Step 3: Derive bulb glows from the ramp** so they theme automatically. Replace the hardcoded rgba glow box-shadows on `.cell[data-state="played"][data-level="N"]` (and their `:hover` variants) with `color-mix`, e.g.:
  ```css
  .cell[data-state="played"][data-level="3"] { background: var(--ramp-3); box-shadow: 0 0 10px -1px color-mix(in srgb, var(--ramp-3) 65%, transparent); }
  ```
  Apply the same pattern to levels 1–4 (level 0 keeps its inset hairline) and the hover shadows (larger radius / higher %). Also swap the `.panel` radial-gradient `rgba(91,230,132,0.05)` to `color-mix(in srgb, var(--accent) 5%, transparent)`.
- [ ] **Step 4: Design the three accent ramps** (luminance-monotonic, colorblind-safe, AA on `--field` #090d12). Candidate ramps to start from, then AA-verify + tune in the browser:
  ```css
  :root[data-league="nhl"]{ --accent:#ff5cc8; --accent-wash:rgba(255,92,200,.15); --accent-line:rgba(255,92,200,.4);
    --ramp-0:#241522; --ramp-1:#8a3a6b; --ramp-2:#c44f97; --ramp-3:#ff5cc8; --ramp-4:#ffb3e6; }
  :root[data-league="nfl"]{ --accent:#5ca8ff; --accent-wash:rgba(92,168,255,.15); --accent-line:rgba(92,168,255,.4);
    --ramp-0:#141d2e; --ramp-1:#2f5a9c; --ramp-2:#3f8fd6; --ramp-3:#5ca8ff; --ramp-4:#bfe0ff; }
  :root[data-league="nba"]{ --accent:#ff9d3c; --accent-wash:rgba(255,157,60,.15); --accent-line:rgba(255,157,60,.4);
    --ramp-0:#2a1a0e; --ramp-1:#9c5a1f; --ramp-2:#e08a2e; --ramp-3:#ff9d3c; --ramp-4:#ffd9a0; }
  ```
  (`:root` with no `data-league`, or `data-league="mlb"`, stays green — keep the green block as `:root, :root[data-league="mlb"]`.)
- [ ] **Step 5: AA-verify each accent** in the browser (controller): `--accent` text/large-text vs `--field`, `--ink-dim` legibility unchanged, every ramp step's luminance strictly increases, and the accent reads as a link/focus color. Tune hexes until AA passes (large text ≥3:1 for the ramp swatches/accent; the accent-as-link/`--accent` on dark should clear 4.5:1 where used as text — note the metric `<strong>` uses `--accent`). Adjust ramp-3/accent toward lighter if a hue can't hit AA as text.
- [ ] **Step 6: Surface the palette to the user for sign-off** (screenshots of all four themes) BEFORE finalizing. Adjust per feedback.
- [ ] **Step 7: Commit** `styles.css` (DESIGN.md/sidecar land in Task 5):
  ```bash
  git add styles.css && git commit -m "feat(theme): semantic accent tokens + per-league ramps (data-league)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 2: Header league switcher (markup + styles)

**Files:** `index.html`, `styles.css`.

- [ ] **Step 1: Add the switcher to the masthead** in `index.html`, and give the subhead an id for dynamic text. Replace the `<header class="masthead">…</header>` block with:
  ```html
  <header class="masthead">
    <div class="masthead__lockup">
      <h1 class="masthead__title">Light it Up</h1>
    </div>
    <nav class="league-switch" role="tablist" aria-label="Choose a league">
      <button class="league-tab" role="tab" type="button" data-league-id="mlb" id="tab-mlb" aria-selected="true">MLB</button>
      <button class="league-tab" role="tab" type="button" data-league-id="nhl" id="tab-nhl" aria-selected="false">NHL</button>
      <button class="league-tab" role="tab" type="button" data-league-id="nfl" id="tab-nfl" aria-selected="false">NFL</button>
      <button class="league-tab" role="tab" type="button" data-league-id="nba" id="tab-nba" aria-selected="false">NBA</button>
    </nav>
    <p class="masthead__sub" id="masthead-sub">See <strong>total bases</strong> per game for any active MLB hitter.</p>
  </header>
  ```
- [ ] **Step 2: Style the switcher** in `styles.css` — a segmented control where each tab carries its OWN league accent (so all four hues are always visible), the active tab is filled/emphasized in its accent, with a visible focus ring. Each tab sets its own accent via an inline-ish per-tab selector:
  ```css
  .league-switch { display:flex; gap:.4rem; flex-wrap:wrap; margin-top:1rem; }
  .league-tab { --tab:#5be684; font:700 .8rem/1 var(--font-body); letter-spacing:.04em; text-transform:uppercase;
    padding:.5rem .85rem; border-radius:var(--radius-sm); cursor:pointer; color:var(--ink-dim);
    background:var(--surface); border:1px solid var(--line);
    border-left:3px solid color-mix(in srgb, var(--tab) 70%, transparent);
    transition:background .16s var(--ease-out), color .16s var(--ease-out), border-color .16s var(--ease-out); }
  .league-tab[data-league-id="mlb"]{ --tab:#5be684; } .league-tab[data-league-id="nhl"]{ --tab:#ff5cc8; }
  .league-tab[data-league-id="nfl"]{ --tab:#5ca8ff; } .league-tab[data-league-id="nba"]{ --tab:#ff9d3c; }
  .league-tab:hover { color:var(--ink); border-color:var(--tab); }
  .league-tab[aria-selected="true"]{ color:#0a0f14; background:var(--tab); border-color:var(--tab); }
  .league-tab:focus-visible { outline:2px solid var(--tab); outline-offset:2px; }
  ```
  (Use the FINAL accent hexes from Task 1 for the per-tab `--tab` values.)
- [ ] **Step 3: Commit** `index.html` + `styles.css`.

---

### Task 3: App wiring — switch, hash, dynamic text, carry-forwards (`app.js`)

**Files:** `app.js`. Concrete sub-steps (subagent-friendly):

- [ ] **Step 1: Provider-driven dynamic text helper.** Add a function that updates the masthead subhead, the legend labels, and `document.title` for the current provider, and call it on load + on switch:
  ```js
  const el2 = {
    sub: document.getElementById('masthead-sub'),
    legendLabels: document.querySelectorAll('.legend__group .legend__label'),
  };
  function applyTheme() {
    document.documentElement.dataset.league = currentProvider.id;
    const p = currentProvider;
    el2.sub.innerHTML = `See <strong>${p.metricLabel}</strong> per ${p.unit} for any active ${p.name} player (${p.seasonLabel}).`;
    // legend "Fewer/More <short>"
    if (el2.legendLabels[0]) el2.legendLabels[0].textContent = `Fewer ${p.metricShort}`;
    if (el2.legendLabels[1]) el2.legendLabels[1].textContent = `More ${p.metricShort}`;
    document.title = `Light it Up — ${p.name} ${p.metricLabel}`;
  }
  ```
  (Add `class="legend__label"` to the two legend label spans in `index.html` if not already distinguishable — verify the markup; the legend currently has `.legend__label` spans for "Fewer/More bases".)
- [ ] **Step 2: `shrinkBoard` (carry-forward 2).** Add a function to remove extra cells when the new provider's board is smaller, and call it during a switch:
  ```js
  function shrinkBoard(n) {
    while (boardCells.length > n) {
      const c = boardCells.pop();
      c.remove();
    }
  }
  ```
- [ ] **Step 3: League switch handler.** Wire the tabs: on click, if different league → update `aria-selected`, set the hash, swap provider, reset state, reload players, re-fit the board:
  ```js
  async function switchLeague(id) {
    if (id === currentProvider.id) return;
    currentProvider = getProvider(id);
    for (const t of document.querySelectorAll('.league-tab'))
      t.setAttribute('aria-selected', String(t.dataset.leagueId === id));
    if (location.hash.slice(1) !== id) location.hash = id;
    applyTheme();
    // reset UI
    el.search.value = ''; matches = []; closeSuggestions();
    show(el.nameplate, false); show(el.legend, false); clearError(); hideTooltip();
    currentRequestId++; // cancel any in-flight load
    fadeBoardOff();
    shrinkBoard(currentProvider.seasonBoxes);
    ensureBoard(currentProvider.seasonBoxes);
    players = [];
    try { await loadPlayers(); } catch { showError('Could not load the player list. Refresh to try again.'); }
  }
  document.querySelector('.league-switch').addEventListener('click', (e) => {
    const tab = e.target.closest('.league-tab');
    if (tab) switchLeague(tab.dataset.leagueId);
  });
  document.querySelector('.league-switch').addEventListener('keydown', (e) => {
    const tabs = [...document.querySelectorAll('.league-tab')];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); switchLeague(next.dataset.leagueId);
    }
  });
  ```
- [ ] **Step 4: Hash on load.** Replace the initial `currentProvider`/`loadPlayers()` bootstrap so the league comes from the hash (default mlb), set the active tab, apply theme, then load players:
  ```js
  const initial = getProvider(location.hash.slice(1));
  currentProvider = initial;
  for (const t of document.querySelectorAll('.league-tab'))
    t.setAttribute('aria-selected', String(t.dataset.leagueId === initial.id));
  ensureBoard(currentProvider.seasonBoxes);
  applyTheme();
  loadPlayers().catch(() => showError('Could not load the player list. Refresh to try again.'));
  ```
  Also handle `window.addEventListener('hashchange', …)` to switch when the hash changes (e.g. back/forward): `const id = location.hash.slice(1) || 'mlb'; if (id !== currentProvider.id) switchLeague(id);`
- [ ] **Step 5: Carry-forward 1 — capture provider in `loadPlayer`.** At the top of `loadPlayer`, add `const provider = currentProvider;` and replace every `currentProvider.` inside that function with `provider.` (so a switch mid-load doesn't mismatch). Also update the status line to be unit-aware: `… played ${playedCount} of the team's ${teamGamesSoFar} ${provider.unit}s so far`.
- [ ] **Step 6:** `/opt/homebrew/bin/node --check app.js` + `/opt/homebrew/bin/node --test` (still green). Commit `app.js`.

---

### Task 4: Provider dynamic-copy fields (`sports/*.js`)

**Files:** `sports/mlb.js`, `sports/nhl.js`, `sports/nfl.js`, `sports/nba.js`.

- [ ] **Step 1:** Add `seasonLabel` and `metricShort` to each provider object:
  - mlb: `seasonLabel: '2026', metricShort: 'bases'`
  - nhl: `seasonLabel: '2025–26', metricShort: 'points'`
  - nfl: `seasonLabel: '2025', metricShort: 'yards'`
  - nba: `seasonLabel: '2025–26', metricShort: 'points'`
- [ ] **Step 2:** `/opt/homebrew/bin/node --check sports/*.js` + `/opt/homebrew/bin/node --test`. Commit.

---

### Task 5: Docs — DESIGN.md, sidecar, data-sources.md (controller-led, impeccable)

**Files:** `DESIGN.md`, `.impeccable/design.json`, `docs/data-sources.md`.

- [ ] **Step 1 (impeccable):** Update `DESIGN.md` + `.impeccable/design.json` for the multi-accent system: reframe "Scoreboard Phosphor" / "The One Signal Rule" as **one signal per selected league**; document all four accent ramps (green/magenta/blue/orange) and the `data-league` token mechanism; add the league switcher component; note the Luminance Rule now holds per-accent. Keep them in sync.
- [ ] **Step 2:** Write `docs/data-sources.md`: the verified per-league sources (MLB statsapi; NHL official via Worker; NFL official play-by-play via Worker + Sleeper + nflverse; NBA ESPN), CORS findings, the Cloudflare Worker's role + routes, rate-limit handling (`/nhl-players` aggregation, edge caching), and the unofficial-source risks + the accepted approximations (NFL active-but-zero-yards → missed; NBA/NHL no trade fallback).
- [ ] **Step 3:** Commit the docs.

---

### Task 6: Full per-sport browser verification (controller)

- [ ] Serve locally; for each league (via the switcher now): no console errors; theme recolors correctly (board ramp, focus ring, links, tag, subhead `<strong>`, loading pulse all shift to the accent); search + board render; played/missed/future states; empty/loading/error states; tooltip/aria parity; keyboard nav of the switcher; `prefers-reduced-motion` (instant theme swap + no ignite stagger); URL hash deep-link (load `/#nhl` directly → NHL). Screenshot desktop + mobile per league.
- [ ] Confirm AA contrast per accent (controller spot-check with a contrast calc on `--accent`/ramp vs `--field`).
- [ ] Fix any issue (TDD a regression for pure-function bugs), re-verify. Then the feature is complete → use the finishing-a-development-branch skill.

---

## Self-Review (completed)

**Spec coverage** (spec §6 theming, §9 a11y, §10 docs): semantic accent tokens + `data-league` overrides + per-league ramps (Task 1); header switcher with per-league accents + keyboard + aria (Tasks 2/3); URL-hash deep-link, no persistent storage (Task 3); dynamic masthead/legend/status/title per sport (Tasks 3/4); both Plan-2 carry-forwards (Task 3 Steps 2/5); DESIGN.md + sidecar multi-accent + data-sources.md (Task 5); per-accent AA + reduced-motion + keyboard verification (Task 6).

**Placeholder scan:** the accent hex ramps are candidates explicitly marked for AA-verification + user sign-off in Task 1 (Steps 5–6) — by design, since they're a visual decision; everything else is concrete.

**Type/name consistency:** `applyTheme`/`switchLeague`/`shrinkBoard` defined and used consistently; providers gain `seasonLabel`+`metricShort` (Task 4) consumed by `applyTheme` (Task 3); `getProvider`/`currentProvider`/`ensureBoard`/`boardCells`/`fadeBoardOff`/`loadPlayers`/`closeSuggestions`/`show`/`clearError`/`hideTooltip` are all existing app.js symbols. `data-league` on `documentElement` matches the CSS `:root[data-league=…]` selectors.

**Risk:** `color-mix` requires a modern browser (fine for a 2026 showpiece; older browsers degrade to no-glow, not broken). The switch resets the board + reloads players each time (NHL/NBA fan-out is Worker-cached now, so re-switch is fast).
