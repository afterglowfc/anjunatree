import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CHANGELOG } from './changelog'
import { REPO_URL } from './constants'
import { SproutIcon } from './Icons'

export type InfoTab = 'welcome' | 'install' | 'about'

const TAB_TITLE: Record<InfoTab, string> = {
  welcome: 'Get started',
  install: 'Install as an app',
  about: 'About',
}

const TAB_ICON: Record<InfoTab, ReactNode> = {
  welcome: <SproutIcon />,
  install: '⇩',
  about: '?',
}

interface Props {
  tab: InfoTab | null
  onOpen: (tab: InfoTab) => void
  onClose: () => void
  onOpenSettings: () => void
}

export default function Info({ tab, onOpen, onClose, onOpenSettings }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  return (
    <>
      <div className="menu" ref={menuRef}>
        <button
          className={`menu-trigger${menuOpen ? ' on' : ''}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Get started, install, about"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="menu-icon" aria-hidden="true">
            ?
          </span>
          <span className="menu-label">About</span>
        </button>
        {menuOpen && (
          <div className="menu-pop right" role="menu">
            {(Object.keys(TAB_TITLE) as InfoTab[]).map((t) => (
              <button
                key={t}
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false)
                  onOpen(t)
                }}
              >
                <span className="menu-item-icon" aria-hidden="true">
                  {TAB_ICON[t]}
                </span>
                {TAB_TITLE[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab && (
        <div className="info-overlay" onClick={onClose}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <button className="panel-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
            <div className="info-tabs">
              {(Object.keys(TAB_TITLE) as InfoTab[]).map((t) => (
                <button key={t} className={t === tab ? 'on' : ''} onClick={() => onOpen(t)}>
                  {TAB_TITLE[t]}
                </button>
              ))}
            </div>
            <div className="info-body">
              {tab === 'welcome' && (
                <>
                  <p className="info-badge">
                    <SproutIcon /> New &amp; growing — expect the odd rough edge
                  </p>
                  <h2>Every Anjuna release, one map you can listen to.</h2>
                  <p>
                    Time runs left to right. Every mark is a release — click one and it plays.
                    No account needed: everything works with free 30-second previews from the
                    start.
                  </p>
                  <ul className="quick-tips">
                    <li>
                      <strong>Click a release</strong> to open it and start listening.
                    </li>
                    <li>
                      <strong>Click it again</strong> (or any release by the same artist) to
                      trace their whole run across the map.
                    </li>
                    <li>
                      <strong>Scroll</strong> to zoom, <strong>drag</strong> to pan.
                    </li>
                    <li>
                      <strong>Surprise Me</strong>, in the header, plays through the map for you.
                    </li>
                    <li>
                      <strong>Listen on</strong>, on any release, opens the full track in
                      Spotify, Apple Music, or YouTube Music.
                    </li>
                  </ul>
                  <div className="info-cta-row">
                    <button className="set-button primary" onClick={onOpenSettings}>
                      Open Settings
                    </button>
                  </div>
                  <p className="set-hint">
                    Settings also has themes, text size, accessibility, and Spotify for
                    your saved releases.
                  </p>
                </>
              )}
              {tab === 'install' && (
                <>
                  <h2>Keep it on your home screen.</h2>
                  <p>
                    AnjunaTree installs like a native app — no app store, nothing to update by
                    hand. Once installed it opens full screen and the map keeps working
                    offline (previews still need a connection).
                  </p>
                  <ul>
                    <li>
                      <strong>iPhone / iPad</strong> — in Safari, tap Share, then{' '}
                      <em>Add to Home Screen</em>.
                    </li>
                    <li>
                      <strong>Android</strong> — in Chrome, tap <em>Install</em> when it
                      appears, or ⋮ → <em>Install app</em>.
                    </li>
                    <li>
                      <strong>Desktop</strong> — in Chrome or Edge, use the install icon in the
                      address bar.
                    </li>
                  </ul>
                </>
              )}
              {tab === 'about' && (
                <>
                  <h2>A passion project, built in the open.</h2>
                  <p>
                    AnjunaTree is an unofficial, non-commercial fan project — not affiliated
                    with, endorsed by, or connected to Anjunabeats, Anjunadeep, Anjunachill,
                    Involved Group, or any artist. Catalogue data is from{' '}
                    <a href="https://musicbrainz.org" target="_blank" rel="noreferrer noopener">
                      MusicBrainz
                    </a>{' '}
                    (CC0) and refreshes weekly; previews and artwork are served live by
                    Apple's iTunes catalogue and never stored here.
                  </p>
                  {Boolean(import.meta.env.VITE_UMAMI_SRC) && (
                    <p className="set-hint">
                      This deployment uses self-hosted, cookie-free analytics
                      (page views only — no personal data, no cross-site tracking).
                    </p>
                  )}

                  <h3 className="info-subhead">What's new</h3>
                  <div className="changelog">
                    {CHANGELOG.map((entry, i) => (
                      <div
                        key={entry.version}
                        className={`changelog-entry${i === 0 ? ' latest' : ''}`}
                      >
                        <div className="changelog-head">
                          <strong>{entry.title}</strong>
                          <span className="changelog-date">{entry.date}</span>
                        </div>
                        <ul>
                          {entry.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <h3 className="info-subhead">Help</h3>
                  <p>
                    Something not working, or not what you expected? This is early — bug
                    reports are genuinely useful.
                  </p>
                  <div className="info-cta-row">
                    <a
                      className="set-button primary"
                      href={`${REPO_URL}/issues/new`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Report a bug on GitHub
                    </a>
                    <a
                      className="set-button"
                      href={REPO_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View source
                    </a>
                  </div>
                  <ul className="set-hint" style={{ marginTop: 10 }}>
                    <li>If a preview won't load, it usually works on a second try.</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
