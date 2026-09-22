import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TreeMark, Wordmark } from './Brand'
import Menu from './Menu'
import SearchBox from './SearchBox'
import Info from './Info'
import type { InfoTab } from './Info'
import InstallPrompt from './InstallPrompt'
import UpdatePrompt from './UpdatePrompt'
import Latest from './Latest'
import MapCanvas from './MapCanvas'
import PlayerBar from './PlayerBar'
import ReleasePanel, { VARIOUS_ARTISTS_MBID } from './ReleasePanel'
import SettingsPanel from './SettingsPanel'
import ShapeLegend from './ShapeLegend'
import StatusToasts from './StatusToasts'
import { setStatus } from './status'
import { LABEL_KEYS, LABEL_META, layoutCatalog, loadCatalog, labelVar } from './data'
import type { CatalogLayout } from './data'
import { applySettings, loadSettings, saveSettings, scaleOf } from './settings'
import type { Settings } from './settings'
import { applyTheme, getTheme, THEMES } from './themes'
import type { ThemeId } from './themes'
import { SlidersIcon } from './Icons'
import * as spotify from './spotify'
import { useSpotify } from './useSpotify'
import { useUpdateFlow } from './useUpdateFlow'
import { LABEL_SITE_URL, REPO_URL } from './constants'
import type { LabelKey, MapNode, NowPlaying, ViewKey } from './types'

interface HashState {
  view: ViewKey
  query: string
  off: LabelKey[]
  release: string | null
  artist: string | null
}

function parseHash(): HashState {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const view = p.get('v') === 'spectrum' ? 'spectrum' : 'labels'
  const off = (p.get('off') ?? '')
    .split(',')
    .filter((k): k is LabelKey => (LABEL_KEYS as string[]).includes(k))
  return {
    view,
    query: p.get('q') ?? '',
    off,
    release: p.get('r'),
    artist: p.get('a'),
  }
}

export default function App() {
  const initial = useRef(parseHash())
  const mapCanvasRef = useRef<HTMLCanvasElement>(null)
  const [layout, setLayout] = useState<CatalogLayout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(initial.current.query)
  const [view, setView] = useState<ViewKey>(initial.current.view)
  const [enabled, setEnabled] = useState<Set<LabelKey>>(
    new Set(LABEL_KEYS.filter((k) => !initial.current.off.includes(k))),
  )
  const [selected, setSelected] = useState<MapNode | null>(null)
  const [constellationId, setConstellationId] = useState<string | null>(null)
  const [radio, setRadio] = useState(false)
  const [infoTab, setInfoTab] = useState<InfoTab | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [playerPaused, setPlayerPaused] = useState(false)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showLatest, setShowLatest] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const spotifyState = useSpotify()
  const updateFlow = useUpdateFlow()

  // A cacheless refresh (UpdatePrompt) appends a one-off cache-busting query
  // param; drop it immediately so it never shows in the address bar or gets
  // treated as app state.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('_v')) return
    url.searchParams.delete('_v')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])

  // First visit → the welcome tab. A returning visit after a new changelog
  // entry shipped → the About tab, where the changelog lives. Either way,
  // this fires once; dismiss() records that it's been seen.
  useEffect(() => {
    if (updateFlow.auto === 'welcome') setInfoTab('welcome')
    else if (updateFlow.auto === 'changelog') setInfoTab('about')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateFlow.auto])

  const theme = useMemo(() => getTheme(settings.theme), [settings.theme])

  // Preferences drive CSS custom properties; the canvas gets the values as props.
  useEffect(() => {
    applyTheme(theme)
    applySettings(settings)
    saveSettings(settings)
  }, [theme, settings])

  // If we came back from the Spotify consent screen, finish the exchange. A
  // failure here is nearly always a redirect-URI mismatch, so surface it in
  // Settings rather than silently doing nothing.
  useEffect(() => {
    spotify
      .completeLoginFromRedirect()
      .then((s) => {
        // A fresh sign-in has to reach the hook, or the player never attaches
        // until the next reload.
        if (s) spotifyState.refresh()
      })
      .catch((e: unknown) => {
        setAuthError(e instanceof Error ? e.message : String(e))
        setShowSettings(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selecting a release lights up its first credited artist's constellation.
  const selectNode = useCallback((n: MapNode | null) => {
    setSelected(n)
    setConstellationId(n?.rel.artistIds.find((id) => id !== VARIOUS_ARTISTS_MBID) ?? null)
    if (!n) setRadio(false)
  }, [])

  useEffect(() => {
    loadCatalog()
      .then(({ releases, generatedAt }) => {
        setLayout(layoutCatalog(releases))
        setGeneratedAt(generatedAt)
      })
      .catch((e) => setError(String(e)))
  }, [])

  // Restore the shared selection once the layout exists.
  useEffect(() => {
    if (!layout || !initial.current.release) return
    const { release, artist } = initial.current
    initial.current.release = null
    const node = layout.nodes.find((n) => n.rel.id === release)
    if (node) {
      setSelected(node)
      setConstellationId(
        artist && node.rel.artistIds.includes(artist)
          ? artist
          : node.rel.artistIds.find((id) => id !== VARIOUS_ARTISTS_MBID) ?? null,
      )
    }
  }, [layout])

  // Keep the URL sharable: it always encodes the current view.
  useEffect(() => {
    const p = new URLSearchParams()
    if (view !== 'labels') p.set('v', view)
    if (query.trim()) p.set('q', query.trim())
    const off = LABEL_KEYS.filter((k) => !enabled.has(k))
    if (off.length) p.set('off', off.join(','))
    if (selected) {
      p.set('r', selected.rel.id)
      if (constellationId) p.set('a', constellationId)
    }
    const hash = p.toString()
    history.replaceState(
      null,
      '',
      hash ? `#${hash}` : window.location.pathname + window.location.search,
    )
  }, [view, query, enabled, selected, constellationId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showSettings) setShowSettings(false)
      else if (infoTab) setInfoTab(null)
      else if (showLatest) setShowLatest(false)
      else selectNode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectNode, infoTab, showSettings, showLatest])

  const isActive = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (n: MapNode) => {
      if (!enabled.has(n.lane)) return false
      if (!q) return true
      return (
        n.rel.artist.toLowerCase().includes(q) ||
        n.rel.title.toLowerCase().includes(q) ||
        n.rel.catno?.toLowerCase().includes(q) ||
        n.rel.artists.some((a) => a.toLowerCase().includes(q))
      )
    }
  }, [query, enabled])

  const constellation = useMemo(() => {
    if (!layout || !constellationId) return []
    return layout.nodes
      .filter((n) => n.rel.artistIds.includes(constellationId))
      .sort((a, b) => a.time - b.time)
  }, [layout, constellationId])

  // Same lookup ReleasePanel does for its own share/export labels — kept
  // here too since the map-image export filename wants it and shouldn't
  // depend on the panel being open.
  const constellationArtistName = useMemo(() => {
    if (!constellationId) return null
    for (const n of constellation) {
      const i = n.rel.artistIds.indexOf(constellationId)
      if (i >= 0) return n.rel.artists[i] ?? n.rel.artist
    }
    return null
  }, [constellation, constellationId])

  // Which releases match the listener's saved Spotify albums/tracks, by the
  // same release-level key spotify.ts builds from the saved side — computed
  // once per catalogue/library pair, not per animation frame, since
  // MapCanvas re-checks this on every draw call.
  const savedNodeIds = useMemo(() => {
    if (!layout || !settings.showSavedReleases || !spotifyState.savedKeys) return null
    const saved = spotifyState.savedKeys
    const ids = new Set<string>()
    for (const n of layout.nodes) {
      const hit = n.rel.artists.some((artist) =>
        saved.has(spotify.releaseKey(artist, n.rel.title)),
      )
      if (hit) ids.add(n.rel.id)
    }
    return ids
  }, [layout, settings.showSavedReleases, spotifyState.savedKeys])

  // Radio: after each release's preview, step to the next one — through the
  // current constellation if the selection is part of it, otherwise
  // chronologically through everything the filters allow.
  const radioNext = useCallback(() => {
    if (!layout || !selected) return
    const walking =
      constellation.length > 1 && constellation.some((n) => n.rel.id === selected.rel.id)
    const queue = walking
      ? constellation
      : [...layout.nodes.filter(isActive)].sort((a, b) => a.time - b.time)
    const i = queue.findIndex((n) => n.rel.id === selected.rel.id)
    const next = queue[i + 1] ?? queue[0]
    if (!next || next.rel.id === selected.rel.id) {
      setRadio(false)
      return
    }
    setSelected(next)
    if (!walking) setConstellationId(null)
  }, [layout, selected, constellation, isActive])

  // Track ended in the player bar: next track in the release, or — in radio —
  // the next release entirely.
  const handleTrackEnded = useCallback(() => {
    if (radio) {
      radioNext()
      return
    }
    setNowPlaying((np) => {
      if (!np) return np
      const next = np.tracks.findIndex((t, i) => i > np.index && t.previewUrl)
      return next >= 0 ? { ...np, index: next } : np
    })
  }, [radio, radioNext])

  const toggleRadio = useCallback(() => {
    if (radio) {
      setRadio(false)
      return
    }
    if (!layout) return
    setRadio(true)
    if (!selected) {
      const queue = [...layout.nodes.filter(isActive)].sort((a, b) => a.time - b.time)
      if (queue.length) {
        setSelected(queue[0])
        setConstellationId(null)
      }
    }
  }, [radio, layout, selected, isActive])

  const setThemeId = useCallback((id: ThemeId) => {
    setSettings((s) => ({ ...s, theme: id }))
  }, [])

  const toggleLabel = useCallback((key: LabelKey) => {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const matchCount = useMemo(
    () => (layout ? layout.nodes.filter(isActive).length : 0),
    [layout, isActive],
  )

  // The canvas itself is transparent (the glow behind it is CSS on
  // .map-wrap) — that's the correct default for "transparent background",
  // and for "themed background" a solid surface-colour fill goes underneath
  // on a fresh composite canvas rather than touching the live one, so
  // exporting can never flash or disturb what's on screen.
  const exportMapImage = useCallback(
    (opts: { transparent: boolean; watermark: boolean }) => {
      const source = mapCanvasRef.current
      if (!source || !source.width || !source.height) {
        setStatus('map-export', 'error', 'Nothing to export yet — give the map a second to load.')
        return
      }
      const out = document.createElement('canvas')
      out.width = source.width
      out.height = source.height
      const ctx = out.getContext('2d')
      if (!ctx) return
      if (!opts.transparent) {
        ctx.fillStyle = theme.colors.surface
        ctx.fillRect(0, 0, out.width, out.height)
      }
      ctx.drawImage(source, 0, 0)
      if (opts.watermark) {
        const scale = out.width / source.clientWidth || 1
        ctx.font = `600 ${13 * scale}px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = opts.transparent ? theme.colors.ink : theme.colors.inkSecondary
        ctx.globalAlpha = 0.85
        ctx.fillText('anjunatree.com', out.width - 14 * scale, out.height - 12 * scale)
        ctx.globalAlpha = 1
      }

      out.toBlob((blob) => {
        if (!blob) {
          setStatus('map-export', 'error', "Couldn't generate the image.")
          return
        }
        const artistSlug = constellationArtistName
          ? `-${constellationArtistName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
          : ''
        const dateSlug = new Date().toISOString().slice(0, 10)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `anjunatree-${view}${artistSlug}-${dateSlug}.png`
        a.click()
        URL.revokeObjectURL(url)
        setStatus('map-export', 'info', 'Image saved.')
      }, 'image/png')
    },
    [theme.colors, view, constellationArtistName],
  )

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <TreeMark className="brand-mark" size={28} />
          <h1>
            <Wordmark />
          </h1>
          <span className="brand-sub">
            the{' '}
            <a href={LABEL_SITE_URL} target="_blank" rel="noreferrer noopener">
              Anjuna
            </a>{' '}
            music catalogue, visualised.
          </span>
        </div>

        <div className="nav-section nav-search">
          <SearchBox value={query} onChange={setQuery} />
        </div>

        {/* --- filters -------------------------------------------------- */}
        <div className="nav-section nav-filters">
          <div className="view-toggle desktop-only" role="tablist" aria-label="Map view">
            <button
              role="tab"
              aria-selected={view === 'labels'}
              className={view === 'labels' ? 'on' : ''}
              onClick={() => setView('labels')}
            >
              Labels
            </button>
            <button
              role="tab"
              aria-selected={view === 'spectrum'}
              className={view === 'spectrum' ? 'on' : ''}
              onClick={() => setView('spectrum')}
            >
              Spectrum
            </button>
          </div>

          <Menu
            label="Filters"
            icon={<SlidersIcon />}
            align="right"
            title="Labels and map view"
            badge={
              enabled.size < LABEL_KEYS.length ? `${enabled.size}/${LABEL_KEYS.length}` : undefined
            }
          >
            {(close) => (
              <>
                <div className="menu-heading">Labels</div>
                {LABEL_KEYS.map((key) => (
                  <label key={key} className="menu-check">
                    <input
                      type="checkbox"
                      checked={enabled.has(key)}
                      onChange={() => toggleLabel(key)}
                    />
                    <span className="legend-dot" style={{ background: labelVar(key) }} />
                    <span className="menu-check-label">{LABEL_META[key].name}</span>
                  </label>
                ))}

                <div className="menu-heading mobile-only">View</div>
                <button
                  className={`menu-item mobile-only${view === 'labels' ? ' on' : ''}`}
                  onClick={() => {
                    setView('labels')
                    close()
                  }}
                >
                  <span className="menu-item-icon" aria-hidden="true">
                    ▤
                  </span>
                  Labels
                </button>
                <button
                  className={`menu-item mobile-only${view === 'spectrum' ? ' on' : ''}`}
                  onClick={() => {
                    setView('spectrum')
                    close()
                  }}
                >
                  <span className="menu-item-icon" aria-hidden="true">
                    ∿
                  </span>
                  Spectrum
                </button>
              </>
            )}
          </Menu>

          <Menu label="Theme" icon="◑" align="right" title="Theme">
            {(close) => (
              <>
                <div className="menu-heading">Theme</div>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`menu-item theme-menu-item${settings.theme === t.id ? ' on' : ''}`}
                    onClick={() => {
                      setThemeId(t.id)
                      close()
                    }}
                  >
                    <span className="theme-menu-swatch">
                      <i style={{ background: t.colors.anjunabeats }} />
                      <i style={{ background: t.colors.anjunadeep }} />
                      <i style={{ background: t.colors.reflections }} />
                    </span>
                    {t.name}
                  </button>
                ))}
              </>
            )}
          </Menu>
        </div>

        {/* --- listen + about/settings ---------------------------------- */}
        <div className="nav-section nav-actions">
          <button
            className={`menu-trigger desktop-only${radio ? ' on accent' : ''}`}
            onClick={toggleRadio}
            title="Play through the map, one preview at a time"
          >
            <span className="menu-icon" aria-hidden="true">
              {radio ? '■' : '▸'}
            </span>
            <span className="menu-label">Surprise Me</span>
          </button>

          <button
            className={`menu-trigger desktop-only${showLatest ? ' on' : ''}`}
            onClick={() => setShowLatest((v) => !v)}
            aria-pressed={showLatest}
            title="What's new on the labels"
          >
            <span className="menu-icon" aria-hidden="true">
              ✦
            </span>
            <span className="menu-label">Release Tracker</span>
          </button>

          <div className="desktop-only">
            <Info
              tab={infoTab}
              onOpen={setInfoTab}
              onClose={() => {
                setInfoTab(null)
                updateFlow.dismiss()
              }}
              onOpenSettings={() => {
                setInfoTab(null)
                updateFlow.dismiss()
                setShowSettings(true)
              }}
            />
          </div>

          <button
            className={`menu-trigger desktop-only${spotifyState.session ? ' connected' : ''}`}
            onClick={() => setShowSettings(true)}
            title={
              spotifyState.session
                ? 'Themes, text size, accessibility, Spotify (connected)'
                : 'Themes, text size, accessibility, Spotify'
            }
          >
            <span className="menu-icon" aria-hidden="true">
              ⚙
            </span>
            <span className="menu-label">Settings</span>
            {spotifyState.session && <span className="menu-dot" aria-hidden="true" />}
          </button>

          {/* Everything above, folded into one control on a narrow screen. */}
          <div className="mobile-only">
            <Menu label="More" icon="⋯" align="right" title="Listen, settings and about">
              {(close) => (
                <>
                  <div className="menu-heading">Listen</div>
                  <button
                    className={`menu-item${radio ? ' on' : ''}`}
                    onClick={() => {
                      toggleRadio()
                      close()
                    }}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      {radio ? '■' : '▸'}
                    </span>
                    {radio ? 'Stop Surprise Me' : 'Start Surprise Me'}
                  </button>
                  <button
                    className={`menu-item${showLatest ? ' on' : ''}`}
                    onClick={() => {
                      setShowLatest((v) => !v)
                      close()
                    }}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      ✦
                    </span>
                    Release Tracker
                  </button>

                  <div className="menu-heading">More</div>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setShowSettings(true)
                      close()
                    }}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      ⚙
                    </span>
                    Settings
                    {spotifyState.session && <span className="menu-dot" aria-hidden="true" />}
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setInfoTab('welcome')
                      close()
                    }}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      ?
                    </span>
                    About AnjunaTree
                  </button>
                </>
              )}
            </Menu>
          </div>
        </div>

        <div className="count">
          {layout ? `${matchCount.toLocaleString()} releases` : 'Loading…'}
        </div>
      </header>

      {error && <div className="status">Failed to load catalogue: {error}</div>}
      {!error && !layout && (
        <div className="status">
          <div className="loading">
            <TreeMark className="loading-mark" size={26} />
            <span>Arranging the catalogue…</span>
          </div>
        </div>
      )}
      {layout && <ShapeLegend layout={layout} isActive={isActive} />}
      {layout && (
        <div className="content-row">
          {showLatest && (
            <Latest
              layout={layout}
              generatedAt={generatedAt}
              selectedId={selected?.rel.id ?? null}
              onSelect={selectNode}
              onClose={() => setShowLatest(false)}
            />
          )}
          <div className="map-wrap">
            <MapCanvas
              ref={mapCanvasRef}
              layout={layout}
              view={view}
              isActive={isActive}
              constellation={constellation}
              selectedId={selected?.rel.id ?? null}
              onSelect={selectNode}
              colors={theme.colors}
              fontScale={scaleOf(settings.fontScale)}
              highContrast={settings.highContrast}
              reduceMotion={settings.reduceMotion}
              largeMarks={settings.largeMarks}
              savedNodeIds={savedNodeIds}
            />
            {view === 'spectrum' && (
              <div className="spectrum-note">
                curated spectrum — label + artist, not per-track data
              </div>
            )}
            {query.trim() && matchCount === 0 && (
              <div className="empty-note">
                <p>No releases match &ldquo;{query.trim()}&rdquo;.</p>
                <button className="set-button" onClick={() => setQuery('')}>
                  Clear search
                </button>
              </div>
            )}
          </div>
          {selected && (
            <ReleasePanel
              node={selected}
              constellationId={constellationId}
              constellation={constellation}
              radio={radio}
              nowPlaying={nowPlaying}
              playerPaused={playerPaused}
              onPlay={setNowPlaying}
              onRadioNext={radioNext}
              onPickArtist={setConstellationId}
              onClose={() => selectNode(null)}
              spotify={spotifyState}
              settings={settings}
            />
          )}
        </div>
      )}

      {nowPlaying && (
        <PlayerBar
          nowPlaying={nowPlaying}
          paused={playerPaused}
          onPausedChange={setPlayerPaused}
          onEnded={handleTrackEnded}
          onJumpTo={() => selectNode(nowPlaying.node)}
          onClose={() => {
            setNowPlaying(null)
            setRadio(false)
          }}
        />
      )}

      <footer className="site-footer">
        <span>
          A fan project, <strong>not affiliated with or endorsed by</strong> Anjunabeats,
          Anjunadeep, Anjunachill, Involved Group, or any artist. Music and artwork
          belong to their rights holders.
        </span>
        <span className="footer-links">
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
            Source on GitHub
          </a>
          <button className="footer-link-button" onClick={() => setInfoTab('about')}>
            About
          </button>
          <a href="privacy.html">Privacy</a>
          <a href="terms.html">Terms</a>
        </span>
      </footer>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          spotify={spotifyState}
          authError={authError}
          onClose={() => {
            setShowSettings(false)
            setAuthError(null)
          }}
          onExportImage={exportMapImage}
        />
      )}
      <StatusToasts />
      <UpdatePrompt />
      <InstallPrompt />
    </div>
  )
}
