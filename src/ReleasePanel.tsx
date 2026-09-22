import { useEffect, useMemo, useRef, useState } from 'react'
import { findRelease, lookupTracks } from './itunes'
import type { ReleaseMatch } from './itunes'
import { LABEL_META, labelVar } from './data'
import { SHAPE_LABEL } from './shapes'
import { REPO_URL } from './constants'
import { setStatus } from './status'
import { ExternalLinkIcon, ShareIcon } from './Icons'
import { appleExactLink, musicLinks, spotifyExactLink, withPreferredFirst } from './musicLinks'
import type { MusicLink } from './musicLinks'
import { findAppleMusicLink } from './appleMusic'
import * as spotifyApi from './spotify'
import type { AlbumTrack, MapNode, NowPlaying } from './types'
import type { SpotifyState } from './useSpotify'
import type { Settings } from './settings'

export const VARIOUS_ARTISTS_MBID = '89ad4ac3-39f7-470e-963a-56509c546377'

// Off for now — the user is evaluating a more robust sidecar tool for
// collecting genre-placement feedback instead of pre-filled GitHub
// Discussions. Flip this back on (and see the `genrePlacementUrl` memo
// below) once that's decided.
const GENRE_PLACEMENT_VOTING_ENABLED = false

interface Props {
  node: MapNode
  constellationId: string | null
  /** chronological path of the highlighted artist's releases, empty when off */
  constellation: MapNode[]
  radio: boolean
  nowPlaying: NowPlaying | null
  playerPaused: boolean
  onPlay: (np: NowPlaying) => void
  onRadioNext: () => void
  onPickArtist: (artistId: string) => void
  onClose: () => void
  spotify: SpotifyState
  settings: Settings
}

type MatchState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; match: ReleaseMatch }

const fmtDuration = (ms: number | null) => {
  if (!ms) return ''
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ReleasePanel({
  node,
  constellationId,
  constellation,
  radio,
  nowPlaying,
  playerPaused,
  onPlay,
  onRadioNext,
  onPickArtist,
  onClose,
  spotify,
  settings,
}: Props) {
  const [match, setMatch] = useState<MatchState>({ status: 'loading' })
  const [tracks, setTracks] = useState<AlbumTrack[] | null>(null)
  const [exporting, setExporting] = useState(false)
  // Bumped by the "Try again" button to force the lookup effect below to
  // re-run without waiting for `rel` itself to change — iTunes' occasional
  // dropped connection (see itunes.ts) already gets four attempts on its
  // own, but a listener shouldn't be stuck if all four land badly.
  const [retryToken, setRetryToken] = useState(0)
  const autoplayedFor = useRef<string | null>(null)
  const { rel } = node

  // "Listen on…" links — start as plain search links (no API call, works
  // for every visitor), then upgrade in place as exact matches resolve.
  // Apple Music resolves for everyone, no connection needed (appleMusic.ts);
  // Spotify only for the small number of accounts that can connect. See
  // musicLinks.ts for the full reasoning.
  const preferred = settings.preferredService === 'ask' ? null : settings.preferredService
  const [listenLinks, setListenLinks] = useState<MusicLink[]>(() =>
    withPreferredFirst(musicLinks(rel.artist, rel.title), preferred),
  )
  useEffect(() => {
    let alive = true
    setListenLinks(withPreferredFirst(musicLinks(rel.artist, rel.title), preferred))

    findAppleMusicLink(rel.artist, rel.title).then((url) => {
      if (!alive || !url) return
      setListenLinks((prev) =>
        withPreferredFirst(
          prev.map((l) => (l.id === 'apple' ? appleExactLink(url) : l)),
          preferred,
        ),
      )
    })

    if (spotify.session && !spotify.needsReconnect) {
      spotifyApi
        .validSession()
        .then((live) => (live ? spotifyApi.findTrackUri(live, rel.artist, rel.title) : null))
        .then((match) => {
          if (!alive || !match) return
          setListenLinks((prev) =>
            withPreferredFirst(
              prev.map((l) =>
                l.id === 'spotify' ? spotifyExactLink(match.uri, settings.openSpotifyInApp) : l,
              ),
              preferred,
            ),
          )
        })
    }

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel, spotify.session, spotify.needsReconnect, preferred, settings.openSpotifyInApp])

  // Credited artists, deduped, for the constellation chips.
  const artists = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; name: string }[] = []
    rel.artistIds.forEach((id, i) => {
      if (!seen.has(id)) {
        seen.add(id)
        out.push({ id, name: rel.artists[i] ?? rel.artist })
      }
    })
    return out
  }, [rel])

  // The traced artist's own name, as credited on whichever constellation
  // release has them — used for both the playlist title and as the artist
  // half of every search query, so a compilation's "Various Artists" credit
  // on `rel.artist` never leaks into the matching.
  const constellationArtistName = useMemo(() => {
    if (!constellationId) return null
    for (const n of constellation) {
      const i = n.rel.artistIds.indexOf(constellationId)
      if (i >= 0) return n.rel.artists[i] ?? n.rel.artist
    }
    return null
  }, [constellation, constellationId])

  const canExportPlaylist =
    Boolean(spotify.session) && !spotify.needsReconnect && constellation.length > 1

  // The hash already encodes the current selection and constellation (see
  // App.tsx's URL-sync effect) — sharing is just handing someone this exact
  // address, dressed up as a button instead of "copy the URL bar yourself".
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus(
        'share-link',
        'info',
        constellationArtistName
          ? `Copied a link to ${constellationArtistName}’s constellation.`
          : 'Copied a link to this release.',
      )
    } catch {
      setStatus('share-link', 'error', "Couldn't copy the link — copy it from the address bar.")
    }
  }

  const exportConstellationPlaylist = async () => {
    if (!constellationArtistName || exporting) return
    setExporting(true)
    setStatus('spotify-export', 'progress', 'Building your playlist…')
    try {
      const releases = constellation.map((n) => ({
        artist: constellationArtistName,
        title: n.rel.title,
      }))
      const result = await spotify.exportPlaylist(
        `${constellationArtistName} — AnjunaTree`,
        `Every ${constellationArtistName} release on the AnjunaTree map. anjunatree.com`,
        releases,
      )
      setStatus(
        'spotify-export',
        'info',
        result.matched === result.total
          ? `Playlist created with all ${result.matched} releases.`
          : `Playlist created with ${result.matched} of ${result.total} releases — Spotify doesn't carry the rest.`,
      )
      window.open(result.url, '_blank', 'noreferrer')
    } catch (e) {
      setStatus(
        'spotify-export',
        'error',
        e instanceof Error ? e.message : 'Could not export the playlist.',
      )
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    let alive = true
    setMatch({ status: 'loading' })
    setTracks(null)
    findRelease(rel)
      .then(async (m) => {
        if (!alive) return
        if (!m) {
          setMatch({ status: 'missing' })
          return
        }
        setMatch({ status: 'ready', match: m })
        if (m.collectionId) {
          const list = await lookupTracks(m.collectionId).catch(() => null)
          if (!alive) return
          setTracks(list?.length ? list : m.fallbackTrack ? [m.fallbackTrack] : [])
        } else {
          setTracks(m.fallbackTrack ? [m.fallbackTrack] : [])
        }
      })
      .catch(() => alive && setMatch({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [rel, retryToken])

  // Selecting a release is intent to listen: hand its queue to the player
  // once, starting on the matched track when the fallback search found one.
  useEffect(() => {
    if (match.status !== 'ready' || !tracks?.length || autoplayedFor.current === rel.id) return
    const wanted = match.match.matchedTrackName
    let idx = wanted ? tracks.findIndex((t) => t.trackName === wanted && t.previewUrl) : -1
    if (idx < 0) idx = tracks.findIndex((t) => t.previewUrl)
    if (idx < 0) return
    autoplayedFor.current = rel.id
    onPlay({
      node,
      tracks,
      index: idx,
      artworkUrl: match.match.artworkUrl,
      collectionName: match.match.collectionName,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, match])

  // Radio shouldn't stall on releases iTunes can't match — skip after a beat.
  useEffect(() => {
    const dead =
      match.status === 'missing' ||
      match.status === 'error' ||
      (match.status === 'ready' && tracks !== null && tracks.length === 0)
    if (!radio || !dead) return
    const timer = setTimeout(onRadioNext, 1800)
    return () => clearTimeout(timer)
  }, [radio, match, tracks, onRadioNext])

  const playRow = (i: number) => {
    if (match.status !== 'ready' || !tracks?.[i]?.previewUrl) return
    onPlay({
      node,
      tracks,
      index: i,
      artworkUrl: match.match.artworkUrl,
      collectionName: match.match.collectionName,
    })
  }

  const isCurrentRelease = nowPlaying?.node.rel.id === rel.id
  const art = match.status === 'ready' ? match.match.artworkUrl : ''

  // Spectrum placement is curated, not measured (src/spectrum.ts) — this
  // just deep-links to a pre-filled GitHub Discussion so pushback arrives in
  // a shape the app (or a maintainer) can actually parse. No dedupe check:
  // that would need authenticated reads against GitHub's Discussions API,
  // which a static site can't do without a backend.
  const genrePlacementUrl = useMemo(() => {
    const pct = Math.round(node.spectrum * 100)
    const labelName = LABEL_META[node.lane].name
    const title = `Genre placement: ${rel.artist} — ${rel.title}`
    const body = [
      'Suggesting a different spectrum placement for this release.',
      '',
      `Currently placed at: ${pct}% (0% = uplifting trance, 100% = ambient) on ${labelName}`,
      `Release: https://anjunatree.com/#r=${rel.id}`,
      '',
      'Where should it sit, and why? (a rough %, or just "more trance" / "more ambient" is fine)',
    ].join('\n')
    const params = new URLSearchParams({
      category: 'genre-placement',
      title,
      body,
    })
    return `${REPO_URL}/discussions/new?${params.toString()}`
  }, [node.spectrum, node.lane, rel])

  return (
    <aside className="panel">
      <button
        className="panel-share"
        onClick={copyShareLink}
        aria-label={
          constellationArtistName
            ? `Copy link to ${constellationArtistName}'s constellation`
            : 'Copy link to this release'
        }
        title={
          constellationArtistName
            ? `Copy link to ${constellationArtistName}'s constellation`
            : 'Copy link to this release'
        }
      >
        <ShareIcon />
      </button>
      <button className="panel-close" onClick={onClose} aria-label="Close panel">
        ✕
      </button>
      <div className="panel-hero">
        {art ? (
          <img className="panel-art" src={art} alt="" />
        ) : (
          <div
            className="panel-art panel-art-placeholder"
            style={{ background: labelVar(node.lane) }}
          />
        )}
        <div className="panel-title">{rel.title}</div>
        <div className="panel-artist">{rel.artist}</div>
        <div className="panel-meta">
          {[SHAPE_LABEL[node.shape], rel.year, rel.catno, LABEL_META[node.lane].name]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div className="panel-listen-links">
          <span className="panel-listen-label">Listen on</span>
          {listenLinks.map((l) => (
            <a
              key={l.id}
              className={`panel-listen-link${l.id === preferred ? ' preferred' : ''}`}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              title={
                l.exact
                  ? undefined
                  : `Opens ${l.id === 'apple' ? 'an' : 'a'} ${l.label} search for this release`
              }
            >
              {l.label}
              <ExternalLinkIcon />
            </a>
          ))}
        </div>
      </div>

      <div className="panel-section-label">Constellation</div>
      <div className="panel-chips">
        {artists.map((a) => (
          <button
            key={a.id}
            className={`artist-chip${a.id === constellationId ? ' on' : ''}`}
            disabled={a.id === VARIOUS_ARTISTS_MBID}
            title={
              a.id === VARIOUS_ARTISTS_MBID
                ? 'Various Artists — too many stars for one constellation'
                : `Trace ${a.name} across the map`
            }
            onClick={() => onPickArtist(a.id)}
          >
            {a.name}
          </button>
        ))}
      </div>

      {canExportPlaylist && (
        <div className="panel-genre-vote">
          <button className="set-button" onClick={exportConstellationPlaylist} disabled={exporting}>
            {exporting
              ? 'Building playlist…'
              : `Export ${constellationArtistName}'s constellation as a playlist`}
          </button>
        </div>
      )}

      {GENRE_PLACEMENT_VOTING_ENABLED && (
        <>
          <div className="panel-section-label">Genre placement</div>
          <div className="panel-genre-vote">
            <a className="set-button" href={genrePlacementUrl} target="_blank" rel="noreferrer">
              Suggest a genre placement
            </a>
          </div>
        </>
      )}

      <div className="panel-section-label">
        Tracks
        {tracks?.length ? ` · ${tracks.length}` : ''}
      </div>
      <div className="panel-tracks">
        {match.status === 'loading' && <div className="panel-note">Finding release…</div>}
        {match.status === 'missing' && (
          <div className="panel-note">No confident match on iTunes for this release.</div>
        )}
        {match.status === 'error' && (
          <div className="panel-note panel-note-retry">
            <span>Lookup failed — iTunes might just be having a moment.</span>
            <button className="set-button" onClick={() => setRetryToken((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}
        {match.status === 'ready' && !tracks && <div className="panel-note">Loading tracks…</div>}
        {match.status === 'ready' && tracks?.length === 0 && (
          <div className="panel-note">Matched, but iTunes lists no playable tracks.</div>
        )}
        {tracks?.map((t, i) => (
          <button
            key={`${t.discNumber}-${t.trackNumber}-${i}`}
            className={`track-row${isCurrentRelease && nowPlaying?.index === i ? ' on' : ''}`}
            disabled={!t.previewUrl}
            onClick={() => playRow(i)}
          >
            <span className="track-num">
              {isCurrentRelease && nowPlaying?.index === i && !playerPaused ? (
                <span className="eq" style={{ color: labelVar(node.lane) }}>
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                t.trackNumber || i + 1
              )}
            </span>
            <span className="track-name">{t.trackName}</span>
            <span className="track-time">{fmtDuration(t.durationMs)}</span>
          </button>
        ))}
      </div>
      <div className="panel-foot">30-second previews · iTunes</div>
    </aside>
  )
}
