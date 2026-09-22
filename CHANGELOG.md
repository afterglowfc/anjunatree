# Changelog

The in-app version (About → What's new) is the short, listener-facing cut of
this list — what someone would actually notice, not every commit. This file
is the fuller, developer-facing version; see `git log` for the complete
history.

## 2026-09-22 — Playback pivot: links, not embedded SDKs

A real architectural change, on the same branch that built the two things
it replaces — the working history is instructive, not something to sand
down. Prompted by asking, after the fact, "is there a better way to enable
full-track playback across services, nearly agnostic of the user's
service?" — and concluding the honest answer was to stop embedding
playback for either provider at all.

- **Removed**: `src/spotifyPlayer.ts` (the Spotify Web Playback SDK
  integration), `src/applePlayer.ts` and `src/useAppleMusic.ts` (the
  MusicKit JS integration). `useSpotify.ts` lost all player-attachment
  state (`playerRef`, `playerReady`, `playback`, `playFull`, `pause`,
  `resume`, `setMuted`, `canPlayFull`) — what's left is purely
  personalization: session, profile, saved-releases sync, disconnect,
  playlist export. `spotify.ts`'s requested scopes dropped `streaming`,
  `user-read-playback-state`, and `user-modify-playback-state` — none of
  them were ever needed for anything but the now-removed embedded player.
  `PlayerBar.tsx` shrank to just the iTunes preview: no more resolving,
  no more source-switching, no third-party playback state to mirror.
- **Added**: `src/appleMusic.ts`, a stateless, no-auth Apple Music catalog
  search — a plain `fetch` to `api.music.apple.com` with the existing
  public developer token, no MusicKit SDK loaded at all. This is a
  genuine improvement over what it replaces, not just a simplification:
  Apple's catalog search only ever needed the developer token, never a
  per-user one, so it now resolves an exact "Listen on Apple Music" link
  for **every visitor**, with no connect step — something the removed
  MusicKit player could never do for anyone who hadn't signed in.
  `musicLinks.ts` gained `spotifyExactLink()` (upgrades a connected
  listener's link to `spotify:track:ID` or the open.spotify.com
  equivalent, their choice) and `withPreferredFirst()` (a new Settings
  preference reorders the Listen-on row). `ReleasePanel.tsx`'s Listen-on
  row now resolves both exact links in the background and swaps them in
  as they arrive, still starting from the zero-dependency search links
  built last time.
- **New settings**: `preferredService` (ask/Spotify/Apple Music/YouTube
  Music — highlights that service first) and `openSpotifyInApp` (native
  `spotify:` URI vs. the web player — Spotify-only, since Apple Music and
  YouTube Music links are universal/app links the OS already resolves on
  its own; there's nothing left for a setting to control there).
- **Why remove rather than keep both paths**: embedding playback for
  either service meant asking every visitor to sign into something just
  to hear a track, on top of the two dead ends already found — Spotify's
  Extended Quota Mode closed to non-commercial projects in May 2025
  (permanent 5-tester cap), and Apple MusicKit JS's exact `api.search()`
  response shape was still unverified without a live subscriber account.
  A plain link needs none of that, works in any browser, on any device,
  for every visitor — the whole reason "Listen on" links existed
  alongside the embedded players in the first place. Once that was true
  for every release, the embedded players were doing strictly less than
  the links already did, for a much smaller audience.
- Settings, the welcome modal, and docs (`docs/DEVELOPMENT.md`,
  `README.md`) all updated to match — including removing the "Connect
  Apple Music" section entirely (nothing left for it to do; Apple's exact
  link needs no connection) and rewriting the Spotify section to be
  honest that connecting it now only ever affects three things —saved-
  release matching, playlist export, and an exact vs. search Spotify
  link — never full-track listening, which never depended on it.
- Noted in `README.md`: this project runs on an irregular, on/off
  schedule, not steady maintenance — said plainly rather than left for
  a visitor to guess from the gaps between commits.

## 2026-08-20 — "Listen on…" links

- New `src/musicLinks.ts` and a "Listen on" row in `ReleasePanel.tsx`:
  plain search-URL deep links to Spotify, Apple Music, and YouTube
  Music, shown on every release for every visitor regardless of
  connection state. No API call, no auth, nothing to sunset.
- Two other approaches were checked and deliberately rejected first,
  not just skipped:
  - **Odesli/song.link** (one link resolving to the same track across
    every service) — checked its current status before building on
    it: Odesli has stopped issuing new API keys, and its API carries a
    deprecation notice with a retirement date that's already passed
    (still limping along past it, not something to build a real
    dependency on now).
  - **Exact-match links via Spotify's Client Credentials flow**
    (app-level auth, no per-user login — and, unlike the per-user OAuth
    flow this app already uses for playback, plausibly not subject to
    Development Mode's 5-user cap at all, since that cap's own wording
    is specifically about "authenticated Spotify users"). Genuinely
    promising, but needs a client secret, and this is a fully static
    site with nowhere safe to hold one — a `VITE_` variable would
    expose it to every visitor's devtools, exactly the misuse
    Spotify's own docs warn against. Not implemented; would need a
    real architecture change (a server or serverless proxy) this
    project has deliberately never had.
- New `ExternalLinkIcon` in `Icons.tsx` — a generic "opens elsewhere"
  glyph, deliberately not any service's own logo, so the row never
  reads as branding or endorsement from Spotify/Apple/YouTube.
- README's "Listen instantly" bullet updated to mention both Apple
  Music and the new link row, alongside Spotify.

## 2026-08-20 — Apple Music: a second full-track provider

- Built on a feature branch (`feature-apple-musickit-playback`), scoped
  deliberately to playback only — no Apple equivalent of Spotify's
  saved-releases sync or playlist export in this pass, since MusicKit's
  library/playlist APIs are different enough to be their own piece of
  work, not a mechanical port.
- **`src/applePlayer.ts`** mirrors `spotifyPlayer.ts`'s shape (load SDK
  once, connect, resolve a track by search, play) using MusicKit JS.
  Apple's auth model turned out simpler than Spotify's: no OAuth
  redirect to complete — `configure()` takes the developer token (from
  `VITE_APPLE_DEV_TOKEN`, already plumbed in from earlier work) and
  `authorize()` handles sign-in in an Apple-hosted popup, with MusicKit
  remembering that authorization internally across reloads.
- **`src/useAppleMusic.ts`** mirrors `useSpotify.ts`'s connect/attach/
  play pattern, including the same StrictMode ref-guard-resets-on-
  cleanup fix documented there. One deliberate addition: a local
  `anjunatree:apple:connected` flag (not a token — MusicKit already
  persists the real authorization) so a returning, previously-connected
  listener reconnects automatically, the same experience Spotify gives
  from its own session, without loading Apple's SDK for a first-time
  visitor who's never connected.
- **`src/PlayerBar.tsx`** generalized from a Spotify-or-preview binary
  to try Spotify, then Apple Music, then the preview — for the rare
  case a listener has both connected. `Mode` gained `'apple'`; the
  finished-track watcher, mute/pause controls, and the source badge all
  now read from whichever provider is actually active instead of
  assuming Spotify.
- **API surface verified against real type definitions, not memory or
  a guess**: Apple's own MusicKit JS reference is a JS-rendered page
  this project's tooling can't read, so `applePlayer.ts` was built
  against the community-maintained `musickit-typescript` package's
  `.d.ts` files (pulled and read directly, not installed as a
  dependency). One thing that couldn't be verified this way: the exact
  runtime shape of `api.search()`'s resolved response. `extractSongs()`
  handles the two shapes Apple's REST docs and MusicKit JS examples
  show, and throws a specific, visible error if neither matches, rather
  than silently returning no results — flagged in `docs/DEVELOPMENT.md`
  as the one thing worth checking against a real developer token and
  subscriber account, which this session had neither of.
- `docs/DEVELOPMENT.md`'s "How it works" and roadmap sections, and
  `src/changelog.ts`, updated to match — this is genuinely
  listener-facing, not an internal refactor.

## 2026-08-20 — Spotify Extended Quota is a dead end

- Corrected course after checking Spotify's current policy directly
  (docs and a developer writeup on the May 2025 change) rather than
  going ahead with the Extended Quota request as planned: as of May
  2025, Spotify's only public-access tier requires being a legally
  registered business already operating at 250k+ monthly active users,
  with individuals excluded from applying entirely — not reachable for
  a non-commercial fan project, no matter how the application is
  written. Also corrected a stale fact along the way: Development
  Mode's tester cap is 5, not the 25 previously documented here.
- Rewrote the Settings note under "Connect Spotify"
  (`SettingsPanel.tsx`) and `docs/DEVELOPMENT.md`'s Spotify section to
  say this plainly instead of framing it as "pending review" — it
  isn't pending, it's structurally closed.
- Re-prioritized `docs/DEVELOPMENT.md`'s roadmap: Apple MusicKit JS is
  now the real path to full-track playback for listeners generally
  (no equivalent MAU/business-entity wall), not just a nice-to-have
  second provider.

## 2026-08-20 — Privacy Policy and Terms of Use

- Added `public/privacy.html` and `public/terms.html` — standalone static
  pages (no JS bundle, no dependency on the app shell) linked from the
  footer. Written to be accurate to what the app actually does, not
  boilerplate: covers exactly what's stored in `localStorage`/
  `sessionStorage` (preferences, last-seen version, Spotify session,
  saved-releases cache), the three third-party services the browser
  talks to directly (Apple's iTunes Search API, Spotify, GitHub Pages),
  and the optional cookie-free Umami analytics some deployments may
  enable. Prompted by preparing Spotify's Extended Quota Mode request,
  which expects a privacy policy URL.
- Not legal advice — a good-faith, plain-language pass appropriate for
  a small non-commercial project with minimal data handling. Revisit
  with real counsel if the project's scope or data handling changes.

## 2026-08-20 — Spotify quota note

- Added a note under the "Connect Spotify" button (`SettingsPanel.tsx`)
  explaining that Spotify currently caps login to accounts approved as
  testers while the app is in Development Mode, so it's expected to
  fail for most listeners right now — not a bug, and not something the
  app can detect or message on its own, since Spotify blocks
  non-whitelisted accounts at its own authorization screen before the
  redirect ever reaches AnjunaTree. Every release still plays a
  30-second preview regardless. Remove this note once Spotify approves
  Extended Quota Mode for public access.

## 2026-08-20 — Moved to the Afterglow Fan Collective org

- Repo transferred from `tmeuze/anjunatree` to
  `afterglowfc/anjunatree` — GitHub's own redirect covers git
  clones/pulls and most web links, but don't recreate a repo at the old
  path or it breaks. Updated everywhere the old path was hardcoded:
  `src/constants.ts`'s `REPO_URL` (the genre-placement Discussion link
  in `ReleasePanel.tsx` derives from it, so no separate change needed
  there), the README's issue link, and both Discussions links in
  `.github/ISSUE_TEMPLATE/config.yml`.
- The [roadmap project](https://github.com/users/tmeuze/projects/2)
  stays a personal, not org, project for now — it's being recreated
  under the org separately, at which point
  `.github/workflows/add-feature-to-roadmap.yml` and the two docs that
  reference it (this file, `docs/DEVELOPMENT.md`) will need their URLs
  updated too, plus `ADD_TO_PROJECT_PAT` re-checked for org-project
  write access.

## 2026-08-20 — Issue templates

- Replaced free-text issue reporting with two [GitHub issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository):
  `bug_report.yml` (title prefixed `[issue] `, labeled `bug`, with required
  Platform/OS/browser fields plus optional view, Spotify-connection state,
  a state-encoding URL, and console errors) and `feature_request.yml`
  (title prefixed `[feature] `, labeled `enhancement`, with a required
  request-type dropdown: UI/UX, Functionality, Integration, Data/Catalogue,
  Accessibility, Other). `config.yml` disables blank issues and points to
  Discussions for genre-placement pushback and general questions instead.
- New `.github/workflows/add-feature-to-roadmap.yml` auto-adds every
  `enhancement`-labeled issue to the
  [roadmap project](https://github.com/users/tmeuze/projects/2). Doesn't set
  a status, by design — see docs/DEVELOPMENT.md's "Issue templates &
  roadmap automation" for the reasoning (a public request shouldn't silently
  become a commitment) and the one-time PAT setup this needs, which can't be
  done from the repo itself.

## 2026-08-20 — README overhaul

- Rebuilt `README.md` around the app's actual distinguishing features
  instead of a flat bullet list: a logo+wordmark hero (new
  `docs/hero-light.svg`/`docs/hero-dark.svg`, generated by
  `scripts/make-readme-hero.ts` from the same `src/brandGeometry.ts` the
  app and its icons draw from, swapped via a `<picture>` +
  `prefers-color-scheme` media query — GitHub's Markdown renderer
  respects it), a staged screenshot of the Labels view, and dedicated
  sections with real screenshots for Surprise Me and Release Tracker
  (`docs/screenshots/*.png`, captured against a live local build with a
  one-off Playwright install — dev/docs tooling only, not a project
  dependency).
- No content changes needed in `CONTRIBUTING.md` or
  `docs/DEVELOPMENT.md` — both were audited against everything shipped
  this cycle (rename to Surprise Me/Release Tracker, social preview
  card, genre-placement button, saved-releases caching, share link, PNG
  export) and found already accurate.

## 2026-08-20 — Countdown

- Announced releases in `Latest.tsx` (Release Tracker) now show a
  countdown pill: `countdownLabel()` reads "today"/"tomorrow" under two
  weeks out, "in N weeks" under two months, "in N months" beyond that —
  coarser the further out, since "in 87 days" isn't more useful than "in
  3 months" and just reads as a stopwatch. Only rendered on upcoming rows
  (`Row`'s new `countdown` prop); "out now" rows are unaffected.
- Shortened the footer disclaimer from three sentences to one — same legal
  content (fan project, not affiliated, not endorsed, rights holders),
  fewer words to read every time it's visible.

## 2026-08-20 — Share it

- **Share link button** (`ShareIcon`, `ReleasePanel.tsx`): copies
  `window.location.href` — no new plumbing, since the hash already encodes
  the current release/constellation selection (`App.tsx`'s URL-sync
  effect). Label and toast text adapt based on whether a constellation is
  active (`constellationArtistName`) vs. just a single release.
- **PNG export** (`App.tsx`'s `exportMapImage`, triggered from a new
  Settings "Export" section): reads the live `<canvas>` via
  `MapCanvas`'s new `forwardRef`/`useImperativeHandle` (exposing the raw
  canvas element, not a custom export API, so the export can never drift
  from the component's own render logic), composites it onto a *new*
  offscreen canvas (never touches the live one — no flash), with two
  options: transparent background (the canvas itself already has none —
  the glow behind it is CSS on `.map-wrap`) vs. filling the current
  theme's surface colour, and an optional small `anjunatree.com`
  watermark. Downloads via a Blob URL and a synthetic `<a download>`
  click; filename includes the current view, constellation artist (if
  any), and date.
- **Deliberately deferred**: real per-artist share preview images (a
  link to a constellation showing that artist's own artwork in a
  Discord/Slack/iMessage preview). Would need either a serverless
  function or a per-artist static build step — a real architecture
  decision for a project that's been fully static end-to-end, not
  something to default into. Recorded in docs/DEVELOPMENT.md's roadmap
  rather than built.

## 2026-08-20 — Matching icons

- **Replaced colour emoji with theme-aware SVG icons.** Emoji render in
  their own fixed colour regardless of `currentColor`, so they were the
  one thing in the icon system that didn't shift with the active theme:
  the mute button (`🔇`/`🔊`) and the welcome badge/tab (`🌱`). Added
  `VolumeIcon`/`MuteIcon`/`PlayIcon`/`PauseIcon`/`StopIcon`/`SproutIcon`
  to `src/Icons.tsx` (same stroke-based, `currentColor` style as the
  existing `SearchIcon`/`SlidersIcon`) and swapped them into
  `PlayerBar.tsx` and `Info.tsx`. `TAB_ICON` in `Info.tsx` changed from
  `Record<InfoTab, string>` to `Record<InfoTab, ReactNode>` to allow it.
- Left the already-monochrome Unicode symbols alone (`✦ ⚙ ✕ ✓ ◑ ▸ ⋯`,
  etc.) — those already render in `currentColor` via inherited `color`
  from theme-token CSS (`--ink`, `--ink-secondary`, `--label-*`), so they
  already tint with the theme; the emoji were the actual gap. No
  contrast work was needed beyond that: `--ink`/`--ink-secondary` and the
  label-accent tokens are already the same CVD/contrast-validated palette
  everything else in the app draws from (see `src/themes.ts`), so an icon
  inheriting one of them is validated by construction.

## 2026-08-20 — Remember me

- **Saved-releases sync now caches to localStorage instead of re-fetching
  the whole library on every page load.** `spotify.ts` gained
  `loadCachedSavedKeys`/`saveCachedSavedKeys`/`clearCachedSavedKeys`
  (`anjunatree:spotify:saved-releases`, a 24h max age); `useSpotify.ts`'s
  sync effect is now stale-while-revalidate — a cached result (even a
  stale one) sets `savedKeys` immediately with no loading state, and a
  network fetch only actually happens when the cache is missing or older
  than a day, or `refreshSavedKeys()` is called explicitly. `logout()`
  clears the cache alongside the session.
- Added `savedKeysSyncedAt` to `SpotifyState` and a "Synced N ago /
  Refresh now" row under the Settings toggle, so the caching isn't
  invisible — a listener can tell it's not just re-fetching quietly, and
  can force a refresh right after saving something new.
- Prompted by the user noticing the app refetched on every reload with no
  visible reason not to cache it.

## 2026-08-17 — Small fixes

- **`.update-cta` (the "new version ready" banner) had no CSS rules at
  all** — it rendered with zero styling, uncoordinated with anything else
  on screen. Gave it a real design: a centered, stylized card fixed to the
  top of the viewport, deliberately not sharing the bottom-left corner
  that `.status-stack` (toasts) and `.install-cta` (the install banner)
  already both anchor to.
- **`.status-stack` and `.install-cta` both anchor to the same fixed
  bottom-left corner**, so a status toast and the install banner could
  render on top of each other. Added `.app:has(.install-cta) .status-stack`
  (and a combined rule for when the player bar is *also* present) to lift
  the toasts clear, extending the same `:has()` pattern already used for
  the player-bar case.
- **iTunes lookup failures got a dead end, not a recovery path.** A failed
  `findRelease`/`lookupTracks` call left "Lookup failed." with no way to
  retry short of closing and reopening the panel. Added a "Try again"
  button (bumps a `retryToken` dependency to re-run the lookup effect
  without needing `rel` itself to change) and extended `itunes.ts`'s retry
  backoff from 2 retries to 3 (`[300, 900, 2000]`ms — 4 attempts total,
  ~3.2s worst case) after continued reports of "Lookup failed" on iOS even
  with the original two-retry version from 2026-08-11.

## 2026-08-16 — Make it yours

- **Personalised map.** Two new Spotify scopes (`user-library-read`,
  `playlist-modify-private`) power two features: an opt-in Settings toggle
  that rings map releases matching the listener's saved albums/tracks
  (`spotify.fetchSavedReleaseKeys`, matched release-level via a shared
  `artist :: title` key so a saved track lights up its whole release), and
  an "Export as playlist" button on any traced constellation
  (`spotify.exportPlaylist`) that creates a private playlist with the
  best-matched Spotify track per release — one track per release via the
  same search-and-score matching `findTrackUri` already used for preview
  fallback, not a full tracklist per release (that would mean an iTunes
  lookup per release just to build the search queries). Already-connected
  listeners get a one-time reconnect prompt, same pattern as the earlier
  streaming-scope addition.
- Off by default: connecting Spotify doesn't itself change what the map
  looks like. Ringing saved releases needs an explicit opt-in
  (`settings.showSavedReleases`); the toggle only appears once the account
  has granted the scope.
- **Found and fixed a real bug while building this**, not specific to the
  new feature: the saved-releases sync effect used a "run once" ref guard
  (`if (alreadySynced.current) return`) that never got reset on cleanup.
  Under React 18 StrictMode's dev-only mount→cleanup→mount, that let the
  *first* (about-to-be-cancelled) attempt claim the guard while the
  *second, real* mount saw it already set and skipped starting a fresh
  attempt — so the sync silently hung forever on every first load in dev.
  The pre-existing Spotify player-connect effect had the exact same
  pattern and, on inspection, the exact same latent bug; fixed both by
  resetting the guard ref in the effect's cleanup rather than only on
  success/failure.
- **Fixed real-account library syncs taking long enough to look hung.**
  `fetchAllPages` fetched saved albums/tracks one page (50 items) at a
  time, sequentially — fine against the handful of items used to test it,
  but a real library of a few thousand saved tracks meant hundreds of
  sequential round trips. Reworked to fetch the first page, read Spotify's
  `total` from it, then fetch every remaining offset in parallel batches
  of 6 (`fetchPage` + a batched loop in `fetchAllPages`), added a 15s
  per-request timeout (`AbortSignal.timeout`) so one stuck request can't
  stall the whole sync, and surfaced running progress
  (`Checking your saved releases… (N so far)`) once there's a real number
  worth showing, so a library that *does* take several seconds no longer
  reads as frozen.

## 2026-08-16 — Cleaner search

- Added a no-results message (with a "Clear search" action) when a search
  matches nothing — previously the map just faded to near-empty with only
  a small "0 releases" counter as a clue.
- Fixed the mobile release panel and Release Tracker sidebar rendering
  *underneath* the header instead of below it: `.content-row` had no
  `position: relative`, so their `position: absolute; inset: 0` escaped to
  the viewport and let the header (higher z-index) cover their own close
  buttons and hide the player bar entirely.
- Added a scrim behind the map's lane/spectrum-band labels
  (`labelScrim()` in `MapCanvas.tsx`) — they're drawn at a fixed position
  at the canvas's left edge, which is also where the earliest releases
  sit, so the text was reading as alpha-blended with whatever dots were
  underneath.

## 2026-08-13 — Sharper edges

- **Fixed the brand mark's trunk and timeline axis rendering invisible in
  every browser and every theme.** Root cause: the structure gradient used
  the SVG default `objectBoundingBox` units, and the axis line is perfectly
  horizontal — a zero-height bounding box, which makes a vertical
  gradient's Y coordinates undefined per spec. Switched to `userSpaceOnUse`
  with explicit coordinates in both `Brand.tsx` and the favicon generator
  (`scripts/make-icons.ts`). This was previously misdiagnosed as a
  Safari-only CSS-custom-property repaint bug (see the 2026-08-11 entry) —
  that fix was real but incomplete; this was the actual cause.
- Renamed "Radio" to "Surprise Me" (previously renamed from "Radio" to "On
  Rotation" on 2026-08-11, then reconsidered — the internal identifiers
  `radio`/`toggleRadio`/`radioNext` never changed).
- Header rework: every control except the logo now right-aligns via a
  single flex `margin-left: auto`, replacing a `.nav-actions`-only auto
  margin that left `.nav-filters` stranded mid-row. Search is a modest
  always-visible field with the magnifying-glass icon as a fixed prefix,
  replacing an icon-that-expands-on-click pattern. Added a new header
  "Theme" menu (`◑`) with the four-theme picker, since a light/dark-only
  toggle was redundant with Sun & Moon already being a light theme — that
  toggle was added and then reverted three days later (2026-08-16). The
  Theme picker was removed from Settings to avoid the duplication;
  Settings now points to the header instead.
- Added `src/Icons.tsx`: small hand-drawn SVG icons (search, sliders) to
  replace ambiguous Unicode glyphs. The sliders icon replaces `◑` for
  Filters, which now goes to Theme instead.
- Hid the "suggest a genre placement" button behind a feature flag
  (`GENRE_PLACEMENT_VOTING_ENABLED` in `ReleasePanel.tsx`) rather than
  removing it — pending a decision on a more robust feedback tool than
  pre-filled GitHub Discussions links.
- Removed several other bits of unshipped-feature and developer-facing
  copy from user-visible UI: a "family labels" note in the Filters menu,
  the Spotify redirect-URI/env-var instructions in Settings (moved to
  `docs/DEVELOPMENT.md`), and two "planned" bullets under the Spotify
  section.
- README rewritten to lead with what the app does and a live link, with
  the technical "how it works"/hosting/secrets/roadmap content moved to
  `docs/DEVELOPMENT.md`.

## 2026-08-11 — Full tracks, and a proper player

- Spotify Web Playback SDK: Premium listeners get full-length tracks instead
  of previews, with automatic fallback to iTunes when Spotify doesn't carry
  a track.
- Player bar rebuilt as a single custom transport (play/pause, mute, stop,
  progress) shared by both playback sources, instead of native `<audio>`
  controls plus a separate ad hoc Spotify transport.
- The real brandmark (`brand/brandmark/at-palm-fan.svg`) replaces the
  placeholder mark, rendered with gradients derived from the active theme.
- Fixed a hang where the Spotify player could get stuck on "Connecting…"
  indefinitely (a re-render loop in `useSpotify`, not a Firefox issue as
  first suspected — Firefox works fine).
- Fixed intermittent "Lookup failed" on iOS Safari (Apple's CORS headers
  interacting badly with the HTTP cache across origins) with a request
  retry and an in-memory response cache.
- Added a standard status-toast system (`src/status.ts` /
  `StatusToasts.tsx`) for progress/error messages, replacing scattered
  inline text.
- Header restructured into independently collapsing sections (search,
  filters, actions) so it never wraps or clips at any width; search
  collapses to an icon by default at every width, not just on mobile.
- Info modal simplified: a single "Get started" tab with CTAs, a
  changelog section and a Help section (links straight to a new GitHub
  issue) inside About; deep technical detail lives in the README instead.
- First visit opens the welcome tab automatically; a returning visit after
  a new entry lands here opens the changelog. Both use one localStorage
  marker (`anjunatree:last-seen-version`).
- Update banner now performs a real cache-bypassing reload rather than a
  plain `location.reload()`.
- Renamed "Radio" to "On Rotation" (renamed again to "Surprise Me" two days
  later, 2026-08-13) and "Latest" to "Release Tracker". Added
  `public/social-card.png` (1200×630) and the `og:*`/`twitter:*` meta tags
  in `index.html`, generated by `scripts/make-social-card.ts` sharing a PNG
  encoder (`scripts/lib/png.ts`) with the icon generator. Also shipped a
  "suggest a genre placement" button this same day — see 2026-08-13, where
  it was flagged off pending a better feedback tool.

## 2026-08-10 — Personalise it

- Four themes named after the music (Black Room Boy, Sirens of the Sea,
  Flow State, Sun & Moon), plus text size, high contrast, larger map marks
  and reduced motion — all in Settings, all persisted locally.
- Installable PWA: manifest, offline precache of the shell/catalogue/fonts,
  install banner, and an "Install as an app" tab in the info modal.
- Spotify sign-in (PKCE) added, ahead of full playback.
- Latest-releases feed: a changelog-style list of newest and
  announced-but-unreleased catalogue entries.
- Weekly catalogue refresh workflow; the ingest script now writes nothing
  when a run finds no changes.

## 2026-08-06 — Follow an artist

- Artist constellations: selecting a release traces every release sharing
  that artist across the map, chronologically.
- Radio mode: plays through the map (or the current constellation) one
  release at a time.
- Spectrum view: a curated genre axis as an alternative to the label lanes.
- Release-type shapes (album/EP/single/compilation/remix package) with a
  legend that recomputes against active filters.
- Shareable URLs — the hash encodes view, search, filters and selection.

## 2026-08-04 — AnjunaTree launches

- Full Anjunabeats/Anjunadeep/Anjunachill catalogue ingested from
  MusicBrainz (~2,900 releases) and laid out as a zoomable timeline map.
- Click-to-play 30-second previews via the iTunes Search API.
