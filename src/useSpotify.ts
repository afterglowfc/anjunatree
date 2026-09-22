import { useCallback, useEffect, useState } from 'react'
import { clearStatus, setStatus } from './status'
import * as spotify from './spotify'
import type { Profile, Session } from './spotify'

// No embedded playback here — full tracks open in Spotify's own app or web
// player via a plain link (see musicLinks.ts). This hook is purely about
// personalization: knowing who's connected, matching their saved releases
// onto the map, and exporting a constellation as a playlist. See
// docs/DEVELOPMENT.md for why: Spotify's Web Playback SDK needs Development
// Mode's 5-user cap, which is effectively permanent for a non-commercial
// project, so it was never going to be a public feature — but reading a
// connected listener's own library and creating their own playlist stays
// genuinely useful at any scale.

export interface SpotifyState {
  session: Session | null
  profile: Profile | null
  /** Signed in before the current scopes existed; one reconnect fixes it. */
  needsReconnect: boolean
  /** Match keys for every saved album/track's release, once loaded — null
   * while loading or signed out, so callers can tell "no matches yet" apart
   * from "haven't checked". */
  savedKeys: Set<string> | null
  loadingLibrary: boolean
  /** When savedKeys last came from Spotify — from cache if that's all
   * there's been time for, freshly fetched otherwise. Null until the first
   * successful sync ever completes. */
  savedKeysSyncedAt: number | null
  /** Force a fresh sync, bypassing the cached copy. */
  refreshSavedKeys: () => void
  disconnect: () => void
  refresh: () => void
  exportPlaylist: (
    name: string,
    description: string,
    releases: { artist: string; title: string }[],
  ) => Promise<{ url: string; matched: number; total: number }>
}

export function useSpotify(): SpotifyState {
  const [session, setSession] = useState<Session | null>(() => spotify.loadSession())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string> | null>(null)
  const [savedKeysSyncedAt, setSavedKeysSyncedAt] = useState<number | null>(null)
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  // Bumped by refreshSavedKeys() to force the sync effect below to skip the
  // cache and hit the network, without needing session/needsReconnect to
  // actually change.
  const [librarySyncNonce, setLibrarySyncNonce] = useState(0)

  const needsReconnect = session ? spotify.needsReconnect(session) : false

  const refresh = useCallback(() => setSession(spotify.loadSession()), [])

  // Identify the account so Settings can show who's connected.
  useEffect(() => {
    let alive = true
    if (!session) {
      setProfile(null)
      return
    }
    spotify.getProfile(session).then((p) => alive && setProfile(p))
    return () => {
      alive = false
    }
  }, [session])

  // Sync saved releases so the map can light them up — stale-while-
  // revalidate against a localStorage cache (spotify.ts), not a fresh fetch
  // on every load. A cold fetch is the single most expensive thing this app
  // asks Spotify for (up to a couple hundred paginated requests for a real
  // library), so a reload shouldn't pay for it again just to show the same
  // answer as five minutes ago. Cached results show immediately; a
  // background refresh only actually hits the network once the cache is
  // more than a day old, or refreshSavedKeys() is called explicitly.
  //
  // No "already synced" ref guard here — deliberately: that pattern doesn't
  // reset its guard on cleanup, so under StrictMode's dev-only double-invoke
  // (mount, cleanup, mount again) the *second, real* run sees the guard
  // already set by the first and skips starting a new attempt, while the
  // first attempt's own result lands on a closure whose `alive` is already
  // false. Net effect: it never resolves, forever. Relying only on `alive`
  // plus the dependency array — same as the profile-fetch effect above —
  // costs one harmless duplicate request in dev and has no such failure mode.
  useEffect(() => {
    if (!session) {
      setSavedKeys(null)
      setSavedKeysSyncedAt(null)
      return
    }
    if (needsReconnect) return

    const forced = librarySyncNonce > 0
    const cached = forced ? null : spotify.loadCachedSavedKeys()
    if (cached) {
      setSavedKeys(cached.keys)
      setSavedKeysSyncedAt(cached.syncedAt)
      if (!cached.stale) return // fresh enough — no network call at all
    }
    // Something was already on screen (from cache, or from an earlier sync
    // this session) — this fetch is a quiet background refresh, not the
    // first-ever wait, whether or not *this particular* fetch bypassed the
    // cache read above to get here.
    const hadData = Boolean(cached) || savedKeys !== null

    let alive = true
    setLoadingLibrary(true)
    setStatus(
      'spotify-library',
      'progress',
      hadData ? 'Refreshing your saved releases…' : 'Checking your saved releases…',
    )
    spotify
      .fetchSavedReleaseKeys(session, (count) => {
        if (!alive || hadData || count < 50) return
        // Only worth showing once there's a real number to report — a big
        // library takes a real, visible number of seconds even fetched in
        // parallel, and "0 so far" for the first instant reads as no better
        // than the plain "Checking…" text. Skipped entirely when a cached
        // result is already on screen — that toast is quieter on purpose.
        setStatus('spotify-library', 'progress', `Checking your saved releases… (${count} so far)`)
      })
      .then((keys) => {
        if (!alive) return
        setSavedKeys(keys)
        const syncedAt = Date.now()
        setSavedKeysSyncedAt(syncedAt)
        spotify.saveCachedSavedKeys(keys)
        clearStatus('spotify-library')
      })
      .catch((e: unknown) => {
        if (!alive) return
        // A stale cache beats no data at all — leave it showing and just
        // report that the refresh itself didn't go through.
        setStatus(
          'spotify-library',
          'error',
          e instanceof Error ? e.message : 'Could not refresh your saved releases.',
        )
      })
      .finally(() => alive && setLoadingLibrary(false))
    return () => {
      alive = false
    }
  }, [session, needsReconnect, librarySyncNonce])

  const refreshSavedKeys = useCallback(() => setLibrarySyncNonce((n) => n + 1), [])

  const disconnect = useCallback(() => {
    spotify.logout() // also clears the cached saved-releases keys
    setSession(null)
    setProfile(null)
    setLibrarySyncNonce(0)
  }, [])

  const exportPlaylist = useCallback(
    async (name: string, description: string, releases: { artist: string; title: string }[]) => {
      const live = await spotify.validSession()
      if (!live) throw new Error('Reconnect Spotify to export a playlist.')
      return spotify.exportPlaylist(live, name, description, releases)
    },
    [],
  )

  return {
    session,
    profile,
    needsReconnect,
    savedKeys,
    loadingLibrary,
    savedKeysSyncedAt,
    refreshSavedKeys,
    disconnect,
    refresh,
    exportPlaylist,
  }
}
