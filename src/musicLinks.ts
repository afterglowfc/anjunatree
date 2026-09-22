// "Listen on…" — service-agnostic full-track links. Every release links
// out to Spotify, Apple Music, and YouTube Music; AnjunaTree never embeds
// playback for any of them. See docs/DEVELOPMENT.md for the full history —
// short version: Spotify's Web Playback SDK needs Development Mode's 5-user
// cap (effectively permanent for a non-commercial project), and Apple
// MusicKit's exact API shape couldn't be verified without a live
// subscriber account. A link sidesteps both problems entirely and works
// for every visitor.
//
// Two smarter-looking approaches were checked and deliberately rejected,
// not just skipped:
//
// - A smart-link aggregator (Odesli/song.link), which resolves one link to
//   the same track across every service. Odesli has stopped issuing new API
//   keys and its API carries a deprecation notice with a retirement date
//   that's already passed (still limping along past it, but not something
//   to build a real dependency on).
// - Exact-match Spotify links via its Client Credentials flow (app-level
//   auth, no per-user login — and, unlike the per-user OAuth flow this app
//   uses for personalization, plausibly exempt from Development Mode's
//   5-user cap). That flow needs a client secret, and this is a fully
//   static site with nowhere safe to hold one; a VITE_ variable would
//   expose it to every visitor's devtools. Not happening without a real
//   architecture change (a server this project has deliberately never had).
//
// What ships instead, per service:
// - Apple Music gets a genuine exact-match link for EVERY visitor, no
//   connection needed — its catalog search only ever required the public
//   developer token, not a per-user one (see appleMusic.ts).
// - Spotify gets an exact-match link only for the small number of accounts
//   that can connect (Development Mode's cap); everyone else gets a search
//   link. `spotify:` URIs open the native app directly when chosen.
// - YouTube Music is always a search link — no catalog API is wired up for
//   it, and its search itself is reliable enough that an exact link isn't
//   worth a fourth API integration.

export type ServiceId = 'spotify' | 'apple' | 'youtube'

export interface MusicLink {
  id: ServiceId
  label: string
  url: string
  /** A real resolved track link vs. a same-artist/title search page. */
  exact: boolean
}

const SERVICE_LABEL: Record<ServiceId, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  youtube: 'YouTube Music',
}

const query = (artist: string, title: string) => encodeURIComponent(`${artist} ${title}`)

function searchLink(id: ServiceId, artist: string, title: string): MusicLink {
  const q = query(artist, title)
  const url =
    id === 'spotify'
      ? `https://open.spotify.com/search/${q}`
      : id === 'apple'
        ? `https://music.apple.com/search?term=${q}`
        : `https://music.youtube.com/search?q=${q}`
  return { id, label: SERVICE_LABEL[id], url, exact: false }
}

/** The default row — search links for all three, before any exact match
 *  has come back. Callers upgrade individual entries once resolved. */
export function musicLinks(artist: string, title: string): MusicLink[] {
  return (['spotify', 'apple', 'youtube'] as const).map((id) => searchLink(id, artist, title))
}

/** A Spotify URI (`spotify:track:ID`) as either the native-app link or the
 *  open.spotify.com web link — the one place a listener's own app-vs-web
 *  preference applies (see settings.ts's `openSpotifyInApp` for why). */
export function spotifyExactLink(uri: string, openInApp: boolean): MusicLink {
  const id = uri.replace('spotify:track:', '')
  const url = openInApp ? uri : `https://open.spotify.com/track/${id}`
  return { id: 'spotify', label: SERVICE_LABEL.spotify, url, exact: true }
}

export function appleExactLink(url: string): MusicLink {
  return { id: 'apple', label: SERVICE_LABEL.apple, url, exact: true }
}

/** Reorders a link row so the preferred service (if any, and if present)
 *  comes first — the "one-click default" a listener has chosen. */
export function withPreferredFirst(links: MusicLink[], preferred: ServiceId | null): MusicLink[] {
  if (!preferred) return links
  const idx = links.findIndex((l) => l.id === preferred)
  if (idx <= 0) return links
  const copy = links.slice()
  const [chosen] = copy.splice(idx, 1)
  copy.unshift(chosen)
  return copy
}
