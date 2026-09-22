// Spotify sign-in via Authorization Code with PKCE.
//
// PKCE exists so browser apps need no client secret: we generate a random
// verifier, send only its SHA-256 hash to Spotify, and prove ownership by
// sending the verifier at token-exchange time. Nothing secret ships.
//
// Set VITE_SPOTIFY_CLIENT_ID in .env.local (or as a GitHub repository
// *variable* in CI). The redirect URI is this page's own URL — register it in
// the Spotify dashboard exactly as redirectUri() returns it, e.g.
//   http://127.0.0.1:5173/     (dev — Spotify rejects plain-http "localhost")
//   https://anjunatree.com/    (production)

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''
const AUTH_HOST = 'https://accounts.spotify.com'
const API = 'https://api.spotify.com/v1'
const STORE = 'anjunatree:spotify'
const VERIFIER_KEY = 'anjunatree:spotify:verifier'
const STATE_KEY = 'anjunatree:spotify:state'
const SAVED_KEYS_STORE = 'anjunatree:spotify:saved-releases'

// `streaming` is what the Web Playback SDK requires, and it is Premium-only —
// Spotify will grant the scope to a free account but refuse to create a player
// for it, so the app checks `product` too and falls back to previews.
// `user-library-read` lights up saved releases on the map; `playlist-modify-
// private` is for exporting a constellation as a playlist — private only, by
// design, so exporting never posts to a listener's public profile without
// them choosing to make it public afterward themselves, in Spotify's own UI.
// Adding scopes invalidates tokens issued before them, hence needsReconnect().
//
// No playback scopes here on purpose — AnjunaTree no longer embeds the
// Spotify Web Playback SDK (see musicLinks.ts / docs/DEVELOPMENT.md): full
// tracks open in Spotify's own app or web player via a plain link instead,
// which needs no scope at all. What's left is purely for personalization:
// matching a listener's saved releases onto the map, and exporting a
// constellation as a playlist.
const SCOPES = ['user-read-email', 'user-read-private', 'user-library-read', 'playlist-modify-private']

// Scopes a stored session must have for every feature to work. Anything
// missing means "reconnect once" rather than "broken" — see needsReconnect().
const REQUIRED_SCOPES = ['user-library-read', 'playlist-modify-private']

export interface Session {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  /** Scopes Spotify actually granted, so stale tokens can be spotted. */
  scope: string
}

/**
 * True when the stored session predates a scope this app now needs (full
 * playback, saved-releases matching, or playlist export). The token still
 * works for reading the basics, so this isn't an error — the listener just
 * has to reconnect once to grant the rest.
 */
export const needsReconnect = (s: Session): boolean => {
  const granted = s.scope.split(' ')
  return REQUIRED_SCOPES.some((scope) => !granted.includes(scope))
}

export interface Profile {
  displayName: string
  product: string | null
}

export const isConfigured = (): boolean => CLIENT_ID.length > 0

export const redirectUri = (): string => window.location.origin + window.location.pathname

function randomString(bytes = 64): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

const base64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s.accessToken) return null
    // Sessions stored before scopes were tracked have no `scope` field.
    return { ...s, scope: s.scope ?? '' }
  } catch {
    return null
  }
}

function storeSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(STORE, JSON.stringify(s))
    else localStorage.removeItem(STORE)
  } catch {
    /* storage unavailable — the session just won't persist */
  }
}

export async function beginLogin(): Promise<void> {
  if (!isConfigured()) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set')
  const verifier = randomString()
  const state = randomString(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
    scope: SCOPES.join(' '),
  })
  window.location.assign(`${AUTH_HOST}/authorize?${params}`)
}

/**
 * Complete the redirect if we came back from Spotify. Always strips the auth
 * params from the URL so a refresh can't replay a spent code.
 */
export class SpotifyAuthError extends Error {}

export async function completeLoginFromRedirect(): Promise<Session | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (!code && !error) return null

  const clean = () => {
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    url.searchParams.delete('error')
    history.replaceState(null, '', url.toString())
  }

  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const expectedState = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  clean()

  if (error) {
    throw new SpotifyAuthError(
      error === 'invalid_client'
        ? 'Spotify rejected the app. Check VITE_SPOTIFY_CLIENT_ID.'
        : `Spotify returned "${error}".`,
    )
  }
  if (!code) return null
  if (!verifier) {
    throw new SpotifyAuthError('Sign-in did not complete — the browser dropped the session.')
  }
  // Mismatched state means the redirect wasn't one we started.
  if (!expectedState || returnedState !== expectedState) {
    throw new SpotifyAuthError('Sign-in state did not match; ignoring this redirect.')
  }

  const res = await fetch(`${AUTH_HOST}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    // Overwhelmingly this is redirect_uri mismatch: Spotify compares the URI
    // *exactly*, including the trailing slash.
    throw new SpotifyAuthError(
      `Token exchange failed (${res.status}). The redirect URI registered in ` +
        `the Spotify dashboard must exactly match:\n${redirectUri()}`,
    )
  }
  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }
  const session: Session = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? '',
  }
  storeSession(session)
  return session
}

export async function refresh(session: Session): Promise<Session | null> {
  if (!session.refreshToken) return null
  const res = await fetch(`${AUTH_HOST}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }
  const next: Session = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? session.scope,
  }
  storeSession(next)
  return next
}

/** Returns a session with a live token, refreshing or clearing as needed. */
export async function validSession(): Promise<Session | null> {
  const s = loadSession()
  if (!s) return null
  if (Date.now() < s.expiresAt - 60_000) return s
  const next = await refresh(s)
  if (!next) storeSession(null)
  return next
}

export async function getProfile(session: Session): Promise<Profile | null> {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { display_name?: string; product?: string }
  return { displayName: json.display_name ?? 'Spotify listener', product: json.product ?? null }
}

export function logout(): void {
  storeSession(null)
  clearCachedSavedKeys()
}

// A saved library doesn't change minute to minute, and fetching it is the
// most expensive thing this app asks Spotify for — up to a couple hundred
// paginated requests for a real collection. Caching it in localStorage means
// a page reload lights up the map instantly from what was there last time,
// instead of the listener staring at "Checking your saved releases…" again
// on every single visit. A day is long enough that the cache is usually
// warm, short enough that a newly-saved album shows up the same day even
// without an explicit refresh.
const SAVED_KEYS_MAX_AGE_MS = 24 * 60 * 60 * 1000

interface SavedKeysCache {
  keys: string[]
  syncedAt: number
}

export function loadCachedSavedKeys(): { keys: Set<string>; syncedAt: number; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(SAVED_KEYS_STORE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedKeysCache
    if (!Array.isArray(parsed.keys) || typeof parsed.syncedAt !== 'number') return null
    return {
      keys: new Set(parsed.keys),
      syncedAt: parsed.syncedAt,
      stale: Date.now() - parsed.syncedAt > SAVED_KEYS_MAX_AGE_MS,
    }
  } catch {
    return null
  }
}

export function saveCachedSavedKeys(keys: Set<string>): void {
  try {
    const payload: SavedKeysCache = { keys: [...keys], syncedAt: Date.now() }
    localStorage.setItem(SAVED_KEYS_STORE, JSON.stringify(payload))
  } catch {
    /* storage unavailable — it just won't persist across reloads */
  }
}

export function clearCachedSavedKeys(): void {
  try {
    localStorage.removeItem(SAVED_KEYS_STORE)
  } catch {
    /* nothing to clear if storage never worked */
  }
}


/** Exported so the catalogue side of matching (App.tsx) normalises releases
 * the exact same way saved albums/tracks are normalised here. */
export const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^\p{Letter}\p{Number} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

interface SpotifyTrack {
  uri: string
  name: string
  duration_ms: number
  artists: { name: string }[]
}

/**
 * Find the Spotify track that matches a catalogue track. Scored rather than
 * taken first-hit, because a bare search happily returns covers, live cuts and
 * unrelated songs that merely share a word with the title.
 */
export async function findTrackUri(
  session: Session,
  artist: string,
  title: string,
): Promise<{ uri: string; durationMs: number } | null> {
  const params = new URLSearchParams({
    q: `${artist} ${title}`,
    type: 'track',
    limit: '10',
  })
  const res = await fetch(`${API}/search?${params}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { tracks?: { items: SpotifyTrack[] } }
  const items = json.tracks?.items ?? []
  if (!items.length) return null

  const wantTitle = norm(title)
  const wantArtist = norm(artist)
  let best: { track: SpotifyTrack; score: number } | null = null
  for (const t of items) {
    const gotTitle = norm(t.name)
    const gotArtists = t.artists.map((a) => norm(a.name)).join(' ')
    let score = 0
    if (gotTitle === wantTitle) score += 6
    else if (gotTitle.startsWith(wantTitle) || wantTitle.startsWith(gotTitle)) score += 4
    else continue // a title that doesn't even prefix-match isn't the track
    // Require some artist agreement, so covers don't win.
    const artistWords = wantArtist.split(' ').filter((w) => w.length > 2)
    const hits = artistWords.filter((w) => gotArtists.includes(w)).length
    if (!hits) continue
    score += (hits / Math.max(1, artistWords.length)) * 4
    if (!best || score > best.score) best = { track: t, score }
  }
  if (!best) return null
  return { uri: best.track.uri, durationMs: best.track.duration_ms }
}

/** `${normalised artist} :: ${normalised album title}` — the key both saved
 * releases and catalogue releases are matched on. Exported so App.tsx builds
 * catalogue-side keys identically. */
export const releaseKey = (artist: string, title: string): string =>
  `${norm(artist)} :: ${norm(title)}`

interface SpotifyAlbumRef {
  name: string
  artists: { name: string }[]
}

const PAGE_SIZE = 50
// A hard stop, not a realistic ceiling: 10,000 saved items is generous for
// matching against a ~3,000-release catalogue, and it bounds how many
// requests one library sync can ever make.
const MAX_ITEMS = 10_000
const CONCURRENCY = 6
const REQUEST_TIMEOUT_MS = 15_000

async function fetchPage(
  session: Session,
  path: string,
  offset: number,
): Promise<{ items: SpotifyAlbumRef[]; total: number }> {
  const url = `${API}${path}?limit=${PAGE_SIZE}&offset=${offset}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) return { items: [], total: 0 }
  const json = (await res.json()) as {
    items: { album?: SpotifyAlbumRef; track?: { album: SpotifyAlbumRef } }[]
    total: number
  }
  const items = json.items.map((item) => item.album ?? item.track?.album).filter((a) => !!a)
  return { items, total: json.total }
}

/**
 * All pages of a saved-items endpoint, fetched with bounded concurrency
 * rather than one request at a time. The first page's `total` tells us every
 * remaining offset up front, so the rest can go out in parallel batches
 * instead of waiting on each page before requesting the next — a library of
 * a few thousand saved tracks was otherwise taking long enough, one request
 * at a time, to look hung rather than just slow. `onProgress` reports items
 * fetched so far, so the UI can say something better than "please wait".
 */
async function fetchAllPages(
  session: Session,
  path: string,
  onProgress: (count: number) => void,
): Promise<SpotifyAlbumRef[]> {
  const first = await fetchPage(session, path, 0)
  const out = [...first.items]
  onProgress(out.length)
  const total = Math.min(first.total, MAX_ITEMS)

  const offsets: number[] = []
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset)

  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY)
    const pages = await Promise.all(
      batch.map((offset) => fetchPage(session, path, offset).catch(() => ({ items: [], total: 0 }))),
    )
    for (const page of pages) out.push(...page.items)
    onProgress(out.length)
  }
  return out
}

/**
 * Every saved album, plus the parent album of every saved track, as match
 * keys — this is release-level (matching AnjunaTree's own granularity), not
 * track-level, so a single saved track lights up its whole release on the
 * map.
 */
export async function fetchSavedReleaseKeys(
  session: Session,
  onProgress?: (count: number) => void,
): Promise<Set<string>> {
  let albumsCount = 0
  let tracksCount = 0
  const report = () => onProgress?.(albumsCount + tracksCount)
  const [albums, trackAlbums] = await Promise.all([
    fetchAllPages(session, '/me/albums', (n) => {
      albumsCount = n
      report()
    }),
    fetchAllPages(session, '/me/tracks', (n) => {
      tracksCount = n
      report()
    }),
  ])
  const keys = new Set<string>()
  for (const album of [...albums, ...trackAlbums]) {
    for (const artist of album.artists) keys.add(releaseKey(artist.name, album.name))
  }
  return keys
}

async function getUserId(session: Session): Promise<string> {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (!res.ok) throw new Error(`Couldn't read the Spotify account (${res.status}).`)
  const json = (await res.json()) as { id: string }
  return json.id
}

/**
 * Create a private playlist and fill it with the best-matched Spotify track
 * for each (artist, title) pair — one track per release, found the same way
 * `findTrackUri` matches a single preview, not a full tracklist per release
 * (that would mean an iTunes lookup per release just to build the search
 * queries, for a feature that's meant to be a quick "take this with you").
 * Releases with no confident match are silently skipped; the caller reports
 * how many of the total actually made it in.
 */
export async function exportPlaylist(
  session: Session,
  name: string,
  description: string,
  releases: { artist: string; title: string }[],
): Promise<{ url: string; matched: number; total: number }> {
  const userId = await getUserId(session)
  const matches: string[] = []
  for (const rel of releases) {
    const match = await findTrackUri(session, rel.artist, rel.title)
    if (match) matches.push(match.uri)
  }
  const createRes = await fetch(`${API}/users/${encodeURIComponent(userId)}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description, public: false }),
  })
  if (!createRes.ok) {
    throw new Error(`Couldn't create the playlist (${createRes.status}).`)
  }
  const playlist = (await createRes.json()) as { id: string; external_urls: { spotify: string } }

  // The add-items endpoint caps at 100 URIs per call.
  for (let i = 0; i < matches.length; i += 100) {
    const batch = matches.slice(i, i + 100)
    const addRes = await fetch(`${API}/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: batch }),
    })
    if (!addRes.ok) {
      throw new Error(`Playlist created, but adding tracks failed (${addRes.status}).`)
    }
  }

  return { url: playlist.external_urls.spotify, matched: matches.length, total: releases.length }
}
