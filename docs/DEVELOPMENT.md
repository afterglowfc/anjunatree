# Development

Technical reference for running, building, and deploying AnjunaTree. If
you're looking for what the app *does*, see the [README](../README.md);
if you want to send a patch, see [CONTRIBUTING](../CONTRIBUTING.md).

## Running it

```bash
npm install
npm run dev
```

The catalog data ships in `public/data/catalog.json`. To refresh it from
MusicBrainz (takes ~1.5 minutes due to their 1 req/s rate limit):

```bash
npm run ingest
```

## How it works

- **Data** — `scripts/ingest.ts` pulls every release for the six official
  Anjuna label entities from the MusicBrainz API (no key required) — the
  ownership chain under Involved Group: Anjunabeats, AnjunaDigital,
  Anjunadeep, Anjunadeep Explorations, Reflections, and Anjunachill — then
  dedupes by release-group and writes a normalized `catalog.json`.
  Radio-show "Broadcast" entries are excluded; each entity folds into one of
  the three lanes (see the `LABELS` table in the script). Artist-run
  offshoot labels (This Never Happened, Odd One Out, …) are researched and
  registered in `src/familyLabels.ts` but not yet ingested.
- **Map** — `src/MapCanvas.tsx` renders all ~2,750 releases on a canvas:
  x = release date, three lanes per label, dot size by type
  (Album > EP > Single), packed with a one-shot d3 force simulation
  (`src/data.ts`). Zoom/pan via d3-zoom, hover hit-testing via d3-quadtree,
  double-click resets the view.
- **Playback** — every release plays a 30-second iTunes preview right in the
  app, no account needed. For the full track, "Listen on" (`musicLinks.ts`,
  in `ReleasePanel.tsx`) opens it in Spotify, Apple Music, or YouTube Music
  instead — a plain link, not embedded playback. AnjunaTree tried embedding
  both Spotify's Web Playback SDK and Apple's MusicKit JS first (still in
  git history) and deliberately moved off both: Spotify's SDK needs
  Development Mode's 5-user cap, which is effectively permanent for a
  non-commercial project (see "Connecting music services" below), and a
  link works in any browser on any device without asking anyone to sign
  into anything. Apple Music's link is a genuine exact match **for every
  visitor, no connection needed** — its catalog search only ever required
  the public developer token, never a per-user one (`appleMusic.ts`, a
  plain `fetch` — no SDK loaded at all). Spotify's link is exact only for
  the small number of accounts that can connect (`findTrackUri` in
  `spotify.ts`); everyone else gets a search link. YouTube Music is always
  a search link. A listener can set a preferred service in Settings
  (`settings.ts`'s `preferredService`), which moves it first in the Listen-on
  row; Spotify additionally offers opening via its `spotify:` URI (the
  native app) instead of the web player — Apple Music and YouTube Music
  links are universal/app links, so the OS already resolves app vs. web on
  its own, with nothing left for a setting to control.
- **Previews & track lists** — clicking a release looks it up on the iTunes
  Search API (`src/itunes.ts`, no auth needed), then pulls the collection's
  full track list via `/lookup?entity=song` — every track with its own
  30-second preview, played from the release panel with auto-advance. Apple
  serves `access-control-allow-origin: *` on both endpoints, so the browser
  calls them directly and the app needs no server of its own. (Local dev
  still routes through the Vite proxy at `/itunes`; `VITE_ITUNES_BASE` is an
  escape hatch if Apple ever drops that header.)
- **Constellations** — selecting a release lights up every release sharing
  its artist's MusicBrainz ID, connected chronologically; chips in the panel
  switch between credited artists (Various Artists is deliberately inert).
- **Surprise Me** — plays through the map chronologically (or walks the current
  constellation), one preview per release, skipping unmatched ones.
- **Shareable URLs** — the hash always encodes view, search, filters, and
  selection; any view of the map is a link.
- **Milestones** — a curated set of label landmarks (`src/milestones.ts`)
  drawn on the time axis; labels appear as you zoom in.
- **Release Tracker** — a changelog-style feed of the newest releases, split into
  what's out now and what's announced but not released yet (`src/Latest.tsx`).
- **Themes & accessibility** — four themes named after the music
  (`src/themes.ts`), four text sizes, high contrast, larger map marks, and
  reduced motion, all persisted locally (`src/settings.ts`, `src/SettingsPanel.tsx`).
- **Installable** — a PWA via `vite-plugin-pwa`: the shell, the catalogue, and
  the fonts are precached, so the whole map works offline. Icons are generated
  dependency-free by `node scripts/make-icons.ts`.
- **Brand** — the mark is transcribed exactly from `brand/brandmark/at-palm-fan.svg`
  into `src/brandGeometry.ts`, the single source both `<TreeMark>` and the icon
  rasteriser draw from. Three gradients (structure, canopy, fan) are derived
  from the active theme's own tokens, so the mark re-colours with every theme
  automatically. The wordmark is live text in
  [Jost](https://github.com/indestructible-type/Jost) (SIL OFL), self-hosted
  rather than loaded from a CDN.
- **Player** — one custom transport (play/pause, mute, stop, progress) shared
  by both playback sources (`src/PlayerBar.tsx`), so switching between a
  preview and a full Spotify track never changes which buttons you're
  looking at.
- **Get started, and staying current** — a first visit opens a short welcome
  tab with CTAs (Connect Spotify, Open Settings); a returning visit after a
  new release lands opens the changelog automatically instead
  (`src/useUpdateFlow.ts`, `src/changelog.ts`). The update banner performs a
  real cache-bypassing reload, not a plain `location.reload()` — see the
  comment in `src/UpdatePrompt.tsx`.
- **Genre placement** — `src/spectrum.ts`'s positions are curated by hand (see
  below); each release panel links to a pre-filled GitHub Discussion so
  listeners can push back on a placement in a shape the app — and a
  maintainer — can actually parse. No duplicate-detection: GitHub's
  Discussions API has no anonymous read access, so a static site can't check
  "has this been suggested already" without a backend.
- **Analytics (optional)** — self-hosted, cookie-free Umami, wired in
  `src/analytics.ts`. Off by default; only activates when both
  `VITE_UMAMI_SRC` and `VITE_UMAMI_WEBSITE_ID` are set, which only the
  maintainer can do since Umami has no shared hosted instance to point at.
- **Fresh by itself** — a scheduled Action re-reads MusicBrainz weekly and
  redeploys only when the catalogue actually changed.
- **Colors** — the three label colors (`#3987e5` / `#199e70` / `#d95926`)
  are a CVD-validated categorical set: all pairs pass colorblind-separation
  and 3:1 contrast checks against the app's dark surface. Shape carries the
  release-type channel so identity is never color-alone.
- **Spectrum** — `src/spectrum.ts` is deliberately editorial: no open data
  source has per-release genre, so each release gets a label baseline nudged
  by hand-curated positions for ~50 roster-defining artists plus a stable
  per-artist jitter. Upgrading it to real data (e.g. a MusicBrainz genre-tag
  crawl, ~45 min at their rate limit) slots in behind the same
  `spectrumScore()` function.

## Connecting music services

The anonymous tier (iTunes previews, and the "Listen on" links — Apple
Music's is exact by default) needs nothing at all. What's left needs
credentials only you can create, and is now entirely about
**personalization**, not playback — neither service is asked to stream
anything into the app:

**Spotify** (personalization: saved-release matching, playlist export,
exact links)
1. <https://developer.spotify.com/dashboard> → *Create app*.
2. Redirect URIs — register the **app's own URL**, with the trailing slash and
   no extra path. A static host has nothing to serve at `/callback`, so
   `src/spotify.ts` redirects back to the page itself and reads the `?code=`
   there:
   - `http://127.0.0.1:5173/` for dev. Spotify no longer accepts plain-http
     `localhost`, so use the literal loopback IP — and browse the dev site at
     `127.0.0.1:5173`, not `localhost:5173`, when testing login.
   - `https://anjunatree.com/` for production (add the
     `https://<user>.github.io/anjunatree/` form too if you test there first).

   If you already registered a `/callback` URI, either add these alongside it or
   change `redirectUri()` in `src/spotify.ts` to match what you registered.
3. Tick *Web API* only — no *Web Playback SDK*, since AnjunaTree doesn't
   embed playback anymore (see "Playback" above). Copy the **Client ID**
   into `.env.local` as `VITE_SPOTIFY_CLIENT_ID=…` (PKCE flow — no client
   secret anywhere in the app).
4. While the app is in Development Mode, add your own Spotify account under
   *User Management* — capped at **5 authenticated users**, all manually
   allowlisted. This is effectively permanent for a project like this one:
   as of May 2025, Extended Quota Mode (Spotify's public-access tier)
   requires being a legally registered business, already operating at
   250k+ monthly active users, and applying via a company email —
   individuals can no longer apply at all. See the
   [quota modes docs](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
   and [this writeup](https://spotify.leemartin.com/) of the change. This
   cap only limits who gets saved-release matching, playlist export, and an
   exact (vs. search) Spotify link — not who can listen, since listening
   was moved off Spotify's API entirely.

**Apple Music** (a genuinely public exact-match link — no per-user
connection at all)
1. Developer account → *Certificates, Identifiers & Profiles* →
   *Identifiers* → new **Media ID** (e.g. `music.one.a64.anjunatree`).
2. *Keys* → new key with **Media Services (MusicKit)** enabled, bound to that
   Media ID → download the `.p8` (one-time download; it is gitignored here,
   never commit it).
3. `node scripts/apple-token.mjs AuthKey_XXXX.p8 <TEAM_ID> <KEY_ID>` → paste
   the printed JWT into `.env.local` as `VITE_APPLE_DEV_TOKEN=…`
   (max validity 180 days — regenerate twice a year).

That's the whole Apple setup — `appleMusic.ts` calls Apple's catalog search
directly with this one token, for every visitor, with nothing to
authorize and nothing to reconnect. There's no equivalent "Apple
personalization" (a saved-library sync mirroring Spotify's) built yet;
MusicKit's Library API needs a real per-user Music-User-Token via
MusicKit JS's `authorize()`, which is different enough from catalog
search to be its own piece of work if it's ever wanted.

`.env.local` is gitignored; both values are client-side-safe by design (the
Client ID is public, the Apple token is meant to ship to browsers — the
secret `.p8` stays on your machine).

## Hosting

AnjunaTree is a **fully static site** — `npm run build` emits a `dist/` folder
(~300 kB of JS, ~1.1 MB of catalog JSON; roughly 310 kB over the wire gzipped)
that any static host can serve. There is no server, no database, and no
runtime compute: the layout, search, and filtering all run in the visitor's
browser, and the two APIs it talks to (MusicBrainz at build time, iTunes at
listen time) are called directly.

HTTPS is required in production for Spotify's login redirect (its OAuth
flow refuses plain HTTP). Apple's catalog search has no such requirement —
it's a plain authenticated fetch, indifferent to the calling page's own
scheme.

**GitHub Pages** is the default here: `.github/workflows/deploy.yml` builds and
publishes on every push to `main`. To turn it on: *Settings → Pages → Source:
**GitHub Actions*** (not "Deploy from a branch").

There is **no `gh-pages` branch** — the workflow uploads `dist/` as a Pages
artifact and deploys it directly, so nothing publish-related is ever committed
to the repo. `main` stays the only branch.

Vite is configured with `base: './'` so a single build works both at a domain
root (`anjunatree.com`) and at a project subpath
(`<user>.github.io/anjunatree/`) — which is where the site lives until DNS is
pointed at GitHub. Keep it relative if you add asset paths.

For the custom domain, set it under *Settings → Pages* (the Actions deploy
method stores it in repo settings; no `CNAME` file needed) and point DNS at
GitHub — four `A` records for the apex (`185.199.108.153`, `.109.153`,
`.110.153`, `.111.153`) plus a `CNAME` for `www` → `<user>.github.io`.

Any of these work equally well if you'd rather not use Pages: Cloudflare Pages,
Netlify, Vercel, or plain nginx on your own box (`root /srv/anjunatree/dist;`
with a `try_files $uri /index.html;` line). Nothing in the app depends on the
host's features.

## Secrets, and why there are almost none

This project is designed so that **contributors can have the whole repo and
still not hold anything sensitive**:

- **`VITE_SPOTIFY_CLIENT_ID` is not a secret.** The PKCE authorization flow
  exists precisely so browser apps need no client secret; the Client ID is
  published in the bundle to every visitor. Store it as a GitHub repository
  *variable*, not a secret.
- **`VITE_APPLE_DEV_TOKEN` is not really a secret either.** MusicKit requires
  the token to reach the browser, so any visitor can read it. It is kept in
  GitHub *secrets* only to avoid pinning a rotating value into git history.
- **The Apple `.p8` private key is the one real secret.** It never goes to a
  browser, never goes into CI, and never goes into the repo (it is gitignored).
  It lives on the maintainer's machine and is used offline by
  `scripts/apple-token.mjs` to mint tokens.

Anything prefixed `VITE_` is inlined into the JavaScript bundle at build time.
**Never put a genuine secret in a `VITE_` variable** — it protects nothing.
See `.env.example`.

One caveat worth understanding before adding collaborators: on GitHub, anyone
with **write** access can add a workflow that prints a repository secret, so
repo secrets are not a boundary against maintainers — only against the public
and against pull requests from forks (which are denied secrets by design). If
you need a real boundary, either scope deployment credentials to a *protected
environment* with required reviewers, or keep them out of GitHub entirely by
letting your host (Cloudflare/Netlify) build from the repo with credentials
stored in its own dashboard.

## Dependencies

Deliberately few — see the README's [Credits](../README.md#credits) section
for what they are and why. Keeping them current and checked is automated
rather than manual:

- **`.github/workflows/ci.yml`** runs on every pull request and push to
  `main`: type-checks, builds, and runs `npm audit --audit-level=high`.
  A high/critical advisory fails the build; nothing merges past it silently.
- **`.github/dependabot.yml`** opens a weekly PR bumping npm dependencies
  (grouped into one PR, not one per package) and another for the GitHub
  Actions themselves. CI has to pass before either can merge.

### Handling the weekly Dependabot PRs

Two PRs show up most Mondays: one grouping npm dependency bumps, one
grouping GitHub Actions version bumps. Neither auto-merges — that's
deliberate, not a missing feature; see below.

1. **Check CI is green** on the PR (the `CI` check, from `ci.yml`). If it's
   red, don't merge — read the failure first.
2. **Look at what's actually in it.** Dependabot's PR description lists
   every package and its old → new version. A patch or minor bump
   (`7.3.6 → 7.3.9`) is routine; a **major** bump (`7.3.6 → 8.0.0`) can
   change behavior CI's type-check-and-build alone won't catch — Vite and
   TypeScript major versions especially.
3. **For a major bump**, don't just trust a green CI check. Pull the
   branch and actually run the app:
   ```bash
   git fetch GitHub
   git worktree add /tmp/dep-test GitHub/<dependabot-branch-name>
   cd /tmp/dep-test && npm ci && npm run dev
   ```
   Click around — search, select a release, switch views, check the
   console for new warnings — then `git worktree remove /tmp/dep-test`
   when done.
4. **Merge via GitHub's UI** (or `git merge --no-ff` locally, which is what
   was used to clear the first batch of these — see commit history around
   2026-08-16 for the pattern, including how to resolve the trivial
   conflicts that come from merging two same-week Actions-bump PRs back to
   back).

There's no auto-merge workflow here on purpose — every PR still gets a
human look, major bump or not. If that's ever worth automating, the
`groups` block in `dependabot.yml` can be split so minor/patch updates
land in one auto-mergeable group and majors always get their own PR
(`groups.<name>.update-types`) — a config change plus a small
`workflow_run`-triggered merge workflow, not a redesign.

If `npm audit` fails a build:

1. Run `npm audit` locally to see which package and advisory.
2. `npm audit fix` handles most transitive-dependency cases automatically.
3. If the flagged package is a direct dependency with no fix yet, check
   whether the advisory actually applies to how this app uses it (browser
   bundle, no server, no user-supplied input to most of it) before treating
   it as urgent — but don't just raise `--audit-level` to make the failure
   go away. Open an issue if it needs a real decision.

## Issue templates & roadmap automation

Bug reports and feature requests use [GitHub issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
(`.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`) rather than
free-text templates, so every report arrives with the fields actually needed
to act on it (platform/OS/browser for bugs; a request-type category for
features) instead of a blank box. `config.yml` disables blank issues and
points to Discussions instead for genre-placement pushback and general
questions.

**`.github/workflows/add-feature-to-roadmap.yml`** auto-adds every issue
labeled `enhancement` (i.e. every feature request, since the template
applies that label) to the [roadmap project](https://github.com/users/tmeuze/projects/2).

This intentionally does **not** skip moderation — it does not set a
status/column, so it lands wherever the project's default new-item status
is. Anyone can open a feature request, including low-effort or duplicate
ones, so the recommended setup is a **"Needs triage"** (or similarly named)
status as the project's default for new items, kept separate from whatever
column represents "actually planned." That gives every request public
visibility on the board without an issue silently becoming a commitment the
moment someone files it — move it into the real backlog by hand once it's
been read. Bugs are not added to the roadmap project at all; they're tracked
as plain labeled issues.

One-time setup this workflow needs (can't be done from the repo — account
settings):

1. Create a **classic Personal Access Token** with the `project` scope at
   <https://github.com/settings/tokens> (a fine-grained token with
   *read/write access to Projects* under your account also works).
2. Add it as a repository secret named `ADD_TO_PROJECT_PAT` (**Settings →
   Secrets and variables → Actions → New repository secret**) — the default
   `GITHUB_TOKEN` can't write to user-owned Projects (v2), only a real PAT
   can.
3. On the project itself, make sure a "Needs triage" (or equivalent) status
   exists and is set as the default for newly added items, so this
   automation actually lands requests somewhere reviewable rather than
   straight into the active plan.

Until the secret exists, the workflow run fails harmlessly (issue still
gets filed and labeled normally) — check the Actions tab if requests aren't
showing up on the board.

## Roadmap

- [x] ~~Full-track playback via the Spotify Web Playback SDK~~ and
      ~~Apple MusicKit JS as a second full-playback provider~~ — both
      built (still in git history), then both replaced by "Listen on"
      links instead. Two separate reasons, not one: Spotify's Extended
      Quota Mode (its only public-access tier) closed to non-commercial
      projects in May 2025, capping Development Mode's embedded player at
      5 testers permanently — not a path to a public feature at all. Apple
      MusicKit JS didn't have that wall, but embedding it still meant
      asking every visitor to sign into an Apple ID just to hear a track,
      and its exact JS API response shape couldn't be verified without a
      live subscriber account. A plain link sidesteps every one of those
      problems and works for every visitor, on every device, in any
      browser — see "Playback" and "Connecting music services" above, and
      CHANGELOG.md for the fuller story of the two false starts.
- [x] "Listen on" links (`musicLinks.ts`, `appleMusic.ts`,
      `ReleasePanel.tsx`) — Spotify, Apple Music, and YouTube Music,
      always available, no connection required. Apple's is a genuine
      exact match for every visitor (catalog search only ever needed the
      public developer token); Spotify's is exact only for the small
      number of accounts that can connect, search otherwise; YouTube
      Music is always a search link. A listener can set a preferred
      service in Settings, which highlights it first.
- [x] Personalised map: an opt-in Settings toggle rings releases matching the
      listener's saved Spotify albums/tracks (`spotify.fetchSavedReleaseKeys`,
      matched release-level in `App.tsx`'s `savedNodeIds`), and any traced
      constellation can be exported as a private Spotify playlist
      (`spotify.exportPlaylist` — one best-matched track per release, not a
      full tracklist per release). Needs the `user-library-read` and
      `playlist-modify-private` scopes, so already-connected listeners see a
      one-time reconnect prompt.
- [ ] Extended-family labels (with the artists' blessing where possible),
      grouped by the parent company's own taxonomy — see
      `src/familyLabels.ts`: *label services* clients of Involved Group
      (This Never Happened, 17 Steps) and *independent* artist labels
      (Odd One Out, MarshanMusic). Needs a lane/color design decision: the
      current 3-color palette is validated all-pairs, so a 4th+ label group
      means re-running the palette validator (likely one shared "family"
      color rather than one per label).
- [ ] Replace the curated spectrum with real genre data (MusicBrainz
      genre-tag crawl per release-group).
- [x] Share a link to an artist's constellation or a single release — the
      hash already encodes both (`App.tsx`'s URL-sync effect), so this
      shipped as a small "copy link" button (`ReleasePanel.tsx`'s share
      icon) rather than new plumbing.
- [x] Export the current map view as a PNG, with a couple of display
      options (transparent background, watermark) — `App.tsx`'s
      `exportMapImage`, triggered from Settings. Composites onto an
      offscreen canvas so it never touches the live one.
- [ ] **Deferred, deliberately:** real per-share preview images — a link to
      a specific artist's constellation showing *their* artwork in the
      Discord/iMessage/Slack preview, not the generic site-wide social
      card. The cheap version above (copy-link + PNG export) covers
      sharing today; doing this properly needs either a serverless
      function (the first non-static piece this project would ever have)
      or pre-generating a static image+HTML shell per artist at build
      time (thousands of artists, meaningful build-size/complexity cost).
      Worth a deliberate decision, not a default yes — see the
      conversation that raised it (`map.anjunatree.com` was the subdomain
      floated for it) before starting.
